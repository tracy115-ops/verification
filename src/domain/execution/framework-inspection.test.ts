import { expect, it } from 'vitest';
import { decodeFrameworkInspection, frameworkInspectionState } from './framework-inspection';
import { inspectionReport } from './framework-inspection.test-support';
import { prepareInvocation } from '../runtime/preparation';
import { emptyComposerDraft } from '../runtime/composer-draft';
import { exampleFramework } from './presets';
import { createDocument } from '../document';

it('distinguishes static declarations, unresolved entry behavior and hard admission issues', () => {
  const report = inspectionReport();
  expect(frameworkInspectionState()).toBe('unchecked');
  expect(frameworkInspectionState(decodeFrameworkInspection(report))).toBe('checked');
  report.checks[3] = { code: 'entry', status: 'unknown', reason: 'entry_dynamic', line: null };
  expect(frameworkInspectionState(decodeFrameworkInspection(report))).toBe('unverified');
  report.checks[3] = { code: 'entry', status: 'error', reason: 'entry_missing', line: null };
  expect(frameworkInspectionState(decodeFrameworkInspection(report))).toBe('blocked');
});
it('rejects corrupt, contradictory, unordered and oversized source hints', () => {
  for (const mutate of [
    (v: ReturnType<typeof inspectionReport>) => {
      v.checks[0].status = 'error';
    },
    (v: ReturnType<typeof inspectionReport>) => {
      v.checks.reverse();
    },
    (v: ReturnType<typeof inspectionReport>) => {
      v.checks[3].line = 2001;
    },
    (v: ReturnType<typeof inspectionReport>) => {
      v.hints.push(v.hints[0]);
    },
    (v: ReturnType<typeof inspectionReport>) => {
      v.sourceSha256 = 'unknown';
    },
  ]) {
    const report = inspectionReport();
    mutate(report);
    expect(() => decodeFrameworkInspection(report)).toThrow('framework_inspection_invalid');
  }
});
it('blocks known framework errors only for the complete verification scope', () => {
  const saved = createDocument();
  saved.revision = 1;
  const framework = exampleFramework();
  const draft = {
    ...emptyComposerDraft('codeagent-native'),
    invoke: true,
    text: 'Verify interface boundaries',
    frameworkId: framework.id,
  };
  const report = inspectionReport();
  report.checks[3] = { code: 'entry', status: 'error', reason: 'entry_missing', line: null };
  expect(prepareInvocation(draft, saved, saved.profiles, [framework], report)?.issues).toContainEqual({
    code: 'framework_inspection_blocked',
  });
  expect(
    prepareInvocation({ ...draft, frameworkId: '' }, saved, saved.profiles, [framework], report)?.issues,
  ).toEqual([]);
  expect(prepareInvocation(draft, saved, saved.profiles, [framework])?.frameworkInspection).toBe('unchecked');
});
