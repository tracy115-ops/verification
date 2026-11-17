import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { inspectionReport } from '../domain/execution/framework-inspection.test-support';
import {
  assertFrameworkInspectionAllows,
  clearFrameworkInspections,
  frameworkInspectionArtifact,
  getFrameworkInspection,
  inspectFramework,
} from './framework-inspection-api';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  isTauri: () => true,
  Channel: class {
    onmessage = () => {};
  },
}));
const input = {
  pythonCommand: 'python',
  frameworkSource: 'import unittest\nclass BlackBoxCase(unittest.TestCase): pass\n',
};
const hash = async () =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.frameworkSource))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
beforeEach(() => {
  vi.clearAllMocks();
  clearFrameworkInspections();
});
afterEach(clearFrameworkInspections);
it('binds checked results and run evidence to the exact source and interpreter', async () => {
  vi.mocked(invoke).mockResolvedValue(inspectionReport(await hash()));
  await inspectFramework(input, new AbortController().signal);
  expect(getFrameworkInspection(input)?.report.sourceSha256).toBe(await hash());
  expect(getFrameworkInspection({ ...input, pythonCommand: 'python3' })).toBeUndefined();
  expect(getFrameworkInspection({ ...input, frameworkSource: `${input.frameworkSource}\n` })).toBeUndefined();
  const artifact = await frameworkInspectionArtifact(input);
  expect(artifact?.type).toBe('FrameworkInspection');
  expect(artifact?.digest).toHaveLength(64);
});
it('invalidates previous success on a failed recheck and rejects a substituted source digest', async () => {
  vi.mocked(invoke)
    .mockResolvedValueOnce(inspectionReport(await hash()))
    .mockRejectedValueOnce('python_not_found');
  await inspectFramework(input, new AbortController().signal);
  await expect(inspectFramework(input, new AbortController().signal)).rejects.toThrow('python_not_found');
  expect(getFrameworkInspection(input)).toBeUndefined();
  vi.mocked(invoke).mockResolvedValue(inspectionReport());
  await expect(inspectFramework(input, new AbortController().signal)).rejects.toThrow(
    'framework_inspection_invalid',
  );
  expect(getFrameworkInspection(input)).toBeUndefined();
});
it('rejects known blockers before creating a verification run artifact', async () => {
  const report = inspectionReport(await hash());
  report.checks[3] = { code: 'entry', status: 'error', reason: 'entry_missing', line: null };
  vi.mocked(invoke).mockResolvedValue(report);
  await inspectFramework(input, new AbortController().signal);
  expect(() => assertFrameworkInspectionAllows(input)).toThrow('framework_inspection_blocked');
  await expect(frameworkInspectionArtifact(input)).rejects.toThrow('framework_inspection_blocked');
});
it('cancels the owned inspection and ignores a late successful response', async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(invoke).mockImplementation(async (command) =>
    command === 'inspect_framework'
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : undefined,
  );
  const controller = new AbortController();
  const pending = inspectFramework(input, controller.signal);
  controller.abort();
  finish(inspectionReport(await hash()));
  await expect(pending).rejects.toThrow('execution_cancelled');
  expect(invoke).toHaveBeenCalledWith('cancel_python', { executionId: expect.any(String) });
  expect(getFrameworkInspection(input)).toBeUndefined();
});
it('does not adopt a response after data restoration clears the inspection cache', async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(invoke).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = inspectFramework(input, new AbortController().signal);
  clearFrameworkInspections();
  finish(inspectionReport(await hash()));
  await expect(pending).rejects.toThrow('framework_inspection_invalid');
  expect(getFrameworkInspection(input)).toBeUndefined();
});
