import { describe, expect, it } from 'vitest';
import { addDependency, addReview, createDocument, decodeDocument } from './document';
import { checkDocument, checkWorkflow, profileIsCompatible } from './workflow';
import { coverageState } from './coverage';
import { browserRepository, DOCUMENT_KEY } from '../services/repository';
import { en, zh } from '../shared/i18n/messages';

describe('workflow contracts', () => {
  it('rejects unregistered operations and operation-kind mismatches', () => {
    const document = createDocument();
    document.definition.nodes[0].operation = 'shell.arbitrary';
    expect(checkWorkflow(document.definition)[0].code).toBe('unknownOperation');
    document.definition.nodes[0].operation = 'scenarios.design';
    expect(checkWorkflow(document.definition)[0].code).toBe('unknownOperation');
  });
  it('validates the preset with 13 nodes and four human gates', () => {
    const document = createDocument();
    expect(checkDocument(document)).toEqual([]);
    expect(document.definition.nodes).toHaveLength(13);
    expect(document.definition.nodes.filter((node) => node.kind === 'human')).toHaveLength(4);
  });
  it('rejects cycles before changing the source document', () => {
    const document = createDocument();
    expect(() => addDependency(document, 'dispatch_actions', 'import_spec')).toThrow('cycle');
    expect(document.definition.nodes[0].dependsOn).toEqual([]);
  });
  it('rejects duplicate node IDs', () => {
    const document = createDocument();
    document.definition.nodes[1].id = document.definition.nodes[0].id;
    expect(checkWorkflow(document.definition)[0].code).toBe('duplicateId');
  });
  it('rejects references to missing outputs and mismatched types', () => {
    const document = createDocument();
    document.definition.nodes[1].inputs.document.from = 'import_spec.missing';
    expect(checkWorkflow(document.definition)[0].code).toBe('invalidBinding');
    document.definition.nodes[1].inputs.document.from = 'import_spec.document';
    document.definition.nodes[1].inputs.document.type = 'WrongType';
    expect(checkWorkflow(document.definition)[0].code).toBe('typeMismatch');
  });
  it('rejects valid output bindings from a non-ancestor', () => {
    const document = createDocument();
    const node = document.definition.nodes[1];
    node.inputs.document = { from: 'dispatch_actions.report', type: 'VerificationReport' };
    expect(checkWorkflow(document.definition)[0].code).toBe('invalidBinding');
  });
  it('rejects unknown dependencies and out-of-range policies', () => {
    const document = createDocument();
    document.definition.nodes[0].dependsOn = ['not_a_node'];
    expect(checkWorkflow(document.definition)[0].code).toBe('unknownDependency');
    document.definition.nodes[0].dependsOn = [];
    document.definition.nodes[0].policy.timeoutSeconds = 0;
    expect(checkWorkflow(document.definition)[0].code).toBe('invalidStructure');
  });
  it('adds an explicit review branch without silently changing existing dependencies', () => {
    const document = createDocument();
    const next = addReview(document, 'design_scenarios');
    expect(next.definition.nodes).toHaveLength(14);
    expect(next.definition.nodes.at(-1)?.dependsOn).toEqual(['design_scenarios']);
    expect(document.definition.nodes).toHaveLength(13);
    expect(checkDocument(next)).toEqual([]);
  });
});

describe('provider metadata', () => {
  it('does not treat Chat Completions as Codex compatible', () => {
    const profile = {
      ...createDocument().profiles[0],
      protocol: 'openai-completions' as const,
      baseUrl: 'https://example.invalid/v1',
      model: 'example',
    };
    expect(profileIsCompatible(profile)).toBe(false);
  });
  it('accepts references and rejects inline secrets or credentials in URLs', () => {
    const profile = {
      ...createDocument().profiles[0],
      protocol: 'openai-responses' as const,
      baseUrl: 'https://example.invalid/v1',
      model: 'example',
      credentialRef: 'env:CORPORATE_KEY',
    };
    expect(profileIsCompatible(profile)).toBe(true);
    expect(profileIsCompatible({ ...profile, credentialRef: 'secret-value' })).toBe(false);
    expect(profileIsCompatible({ ...profile, baseUrl: 'https://user:password@example.invalid/v1' })).toBe(
      false,
    );
    expect(profileIsCompatible({ ...profile, baseUrl: 'https://example.invalid/v1?key=value' })).toBe(false);
  });
  it('rejects imported extra key material and unknown profile bindings', () => {
    const document = createDocument();
    expect(() =>
      decodeDocument({ ...document, profiles: [{ ...document.profiles[0], apiKey: 'do-not-store' }] }),
    ).toThrow('invalidDocument');
    document.bindings.design_scenarios = 'unknown-profile';
    expect(checkDocument(document)[0].code).toBe('unknownProfile');
  });
});

describe('draft persistence', () => {
  function memoryStorage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
  }
  it('round-trips revisions, node positions and profile bindings', () => {
    const storage = memoryStorage();
    const repository = browserRepository(storage);
    const document = createDocument();
    document.layout.design_scenarios = { x: 222, y: 333 };
    document.bindings.design_scenarios = 'claude-native';
    const saved = repository.save(document);
    expect(saved.revision).toBe(1);
    expect(document.revision).toBe(0);
    expect(repository.load()).toEqual(saved);
  });
  it('preserves the existing draft when a new document is invalid', () => {
    const storage = memoryStorage();
    const repository = browserRepository(storage);
    const good = repository.save(createDocument());
    const bad = createDocument();
    bad.definition.nodes[0].dependsOn = ['missing'];
    expect(() => repository.save(bad)).toThrow();
    expect(repository.load()).toEqual(good);
  });
  it('reports corrupt storage without deleting or overwriting it', () => {
    const storage = memoryStorage();
    storage.setItem(DOCUMENT_KEY, '{invalid-json');
    expect(() => browserRepository(storage).load()).toThrow();
    expect(storage.getItem(DOCUMENT_KEY)).toBe('{invalid-json');
  });
  it('rejects incompatible import versions', () => {
    expect(() => decodeDocument({ ...createDocument(), formatVersion: 99 })).toThrow('invalidDocument');
  });
});

describe('review semantics and localization', () => {
  it('never treats an empty or candidate set as confirmed coverage', () => {
    expect(coverageState([])).toBe('unassessed');
    expect(coverageState(['confirmed', 'missing'])).toBe('missing');
    expect(coverageState(['confirmed', 'candidate'])).toBe('candidate');
    expect(coverageState(['confirmed', 'confirmed'])).toBe('confirmed');
  });
  it('keeps both UI catalogs aligned', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    expect(Object.values(en).every((message) => message.trim().length > 0)).toBe(true);
  });
});
