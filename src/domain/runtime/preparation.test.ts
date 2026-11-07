import { expect, it } from 'vitest';
import { prepareInvocation } from './preparation';
import { emptyComposerDraft } from './composer-draft';
import { createDocument } from '../document';
import { createRun } from './plan';
import type { FrameworkProfile } from '../execution/types';

function setup() {
  const saved = createDocument();
  saved.revision = 1;
  const draft = { ...emptyComposerDraft('codeagent-native'), invoke: true, text: '测试边界' };
  return { saved, draft };
}
const framework: FrameworkProfile = {
  id: 'local',
  name: 'Local',
  adapter: 'python-unittest-v1',
  pythonCommand: 'python',
  frameworkSource: 'class Client: pass',
  instructions: '',
  targetUrl: 'http://127.0.0.1:4319',
  timeoutSeconds: 60,
};

it('previews actual session selection without mutating saved bindings or requiring CodeAgent model', () => {
  const { saved, draft } = setup();
  const original = structuredClone(saved);
  const result = prepareInvocation(draft, saved, saved.profiles, [])!;
  expect(result.issues).toEqual([]);
  expect(result.agents.map((agent) => agent.id)).toEqual(['codeagent-native']);
  const run = createRun(saved, 'session', draft.text, saved.profiles, draft.profileId, undefined, 'session');
  expect(result.stepCount).toBe(run.plan.length);
  expect(result.agents[0].nodeIds).toEqual(run.plan.filter((node) => node.role).map((node) => node.id));
  expect(saved).toEqual(original);
});

it('uses current profiles for active bindings and ignores execution-only agents for design', () => {
  const { saved, draft } = setup();
  const current = structuredClone(saved.profiles);
  const codeagent = current.find((profile) => profile.driver === 'codeagent')!;
  const codex = current.find((profile) => profile.driver === 'codex')!;
  for (const node of saved.definition.nodes) if (node.role) saved.bindings[node.id] = codeagent.id;
  const implementation = saved.definition.nodes.find((node) => node.operation === 'tests.implement')!;
  saved.bindings[implementation.id] = codex.id;
  draft.useNodeBindings = true;
  expect(prepareInvocation(draft, saved, current, [])!.issues).toEqual([]);
  draft.frameworkId = framework.id;
  expect(prepareInvocation(draft, saved, current, [framework])!.issues).toContainEqual({
    code: 'model_required',
    profileId: codex.id,
  });
  codex.model = 'current-model';
  const result = prepareInvocation(draft, saved, current, [framework])!;
  expect(result.issues).toEqual([]);
  expect(result.agents.find((agent) => agent.id === codex.id)?.profile?.model).toBe('current-model');
  expect(result.stepCount).toBe(
    createRun(saved, 'session', draft.text, current, codeagent.id, framework).plan.length,
  );
});

it('reports missing Agent once per actual profile and validates framework before invocation', () => {
  const { saved, draft } = setup();
  expect(prepareInvocation(draft, saved, [], [])!.issues).toEqual([
    { code: 'profile_missing', profileId: draft.profileId },
  ]);
  draft.frameworkId = framework.id;
  expect(prepareInvocation(draft, saved, saved.profiles, [])!.issues).toContainEqual({
    code: 'execution_invalid',
  });
  for (const [patch, code] of [
    [{ targetUrl: 'http://user:password@localhost' }, 'target_invalid'],
    [{ pythonCommand: 'cmd.exe' }, 'python_invalid'],
  ] as const) {
    expect(
      prepareInvocation(draft, saved, saved.profiles, [{ ...framework, ...patch }])!.issues,
    ).toContainEqual({ code });
  }
});

it('blocks a deleted session profile even when every node has a valid explicit binding', () => {
  const { saved, draft } = setup();
  draft.useNodeBindings = true;
  draft.profileId = 'deleted-session-profile';
  for (const node of saved.definition.nodes) if (node.role) saved.bindings[node.id] = 'codeagent-native';
  expect(prepareInvocation(draft, saved, saved.profiles, [])!.issues).toEqual([
    { code: 'profile_missing', profileId: draft.profileId },
  ]);
});

it('handles malformed /run safely and mirrors chat slash-command design-only scope', () => {
  const { saved, draft } = setup();
  draft.invoke = false;
  expect(prepareInvocation(draft, saved, saved.profiles, [])).toBeUndefined();
  draft.text = '/run wrong';
  expect(prepareInvocation(draft, saved, saved.profiles, [])!.issues).toEqual([
    { code: 'workflow_not_found' },
  ]);
  draft.text = `/run ${saved.definition.id} 测试`;
  draft.frameworkId = 'stale-framework-from-previous-mode';
  const result = prepareInvocation(draft, saved, saved.profiles, [])!;
  expect(result.issues).toEqual([]);
  expect(result.execution).toBe(false);
  draft.editDesign = true;
  expect(prepareInvocation(draft, saved, saved.profiles, [])).toBeUndefined();
});

it('reports unsaved, invalid graph, blank and oversized specs without a model call', () => {
  const { saved, draft } = setup();
  expect(prepareInvocation(draft, null, saved.profiles, [])!.issues[0].code).toBe('workflow_not_saved');
  draft.text = ' ';
  expect(prepareInvocation(draft, saved, saved.profiles, [])!.issues[0].code).toBe(
    'preparation_spec_missing',
  );
  draft.text = 'a'.repeat(40001);
  expect(prepareInvocation(draft, saved, saved.profiles, [])!.issues[0].code).toBe('prompt_too_large');
  saved.definition.nodes[0].dependsOn = [saved.definition.nodes[0].id];
  expect(prepareInvocation(draft, saved, saved.profiles, [])!.issues[0].code).toBe('invalid_run');
});
