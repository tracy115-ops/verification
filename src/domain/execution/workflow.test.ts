import { describe, expect, it } from 'vitest';
import { advanceRun, approveRun } from '../runtime/engine';
import { verificationPorts, verificationRun, implementation, fixturePlan } from './fixtures.test-support';
import { latestArtifact } from '../runtime/bindings';
import { decodeImplementation, decodeVerdict } from './validation';
import { cases } from '../runtime/fixtures.test-support';
import { isReport } from './schema';
import type { WorkflowRun } from '../runtime/types';
import type { EvidenceBundle } from './types';

async function approve(run: WorkflowRun) {
  const node = run.plan.find((node) => run.steps[node.id].status === 'awaiting_review')!;
  return approveRun(run, node.id, run.steps[node.id].reviewDigest!);
}
describe('complete verification workflow', () => {
  it('executes all 13 nodes behind four approvals and produces evidence-based follow-up', async () => {
    const ports = verificationPorts();
    let run = verificationRun();
    expect(run.plan).toHaveLength(13);
    for (let gate = 0; gate < 4; gate++) {
      run = await advanceRun(
        run,
        ports.agent,
        new AbortController().signal,
        () => {},
        () => {},
        ports.execution,
      );
      expect(run.status).toBe('awaiting_review');
      expect(ports.calls).not.toContain('targets.execute');
      run = await approve(run);
    }
    run = await advanceRun(
      run,
      ports.agent,
      new AbortController().signal,
      () => {},
      () => {},
      ports.execution,
    );
    expect(run.status).toBe('completed');
    expect(run.approvals).toHaveLength(4);
    expect(ports.calls).toEqual([
      'requirements.extract',
      'scenarios.design',
      'cases.generate',
      'tests.implement',
      'targets.preflight',
      'targets.execute',
      'verdicts.evaluate',
    ]);
    const report = latestArtifact(run, 'VerificationReport');
    expect(isReport(report)).toBe(true);
    if (!isReport(report)) throw new Error('report required');
    expect(report.status).toBe('candidates_found');
    expect(report.policy).toBe('report_only');
    expect(report.counts.failed).toBe(1);
  });
  it.each(['error', 'skipped', 'passed'] as const)(
    'never converts %s into a candidate defect',
    async (status) => {
      const ports = verificationPorts(status);
      let run = verificationRun();
      for (let gate = 0; gate < 4; gate++) {
        run = await advanceRun(
          run,
          ports.agent,
          new AbortController().signal,
          () => {},
          () => {},
          ports.execution,
        );
        run = await approve(run);
      }
      run = await advanceRun(
        run,
        ports.agent,
        new AbortController().signal,
        () => {},
        () => {},
        ports.execution,
      );
      const report = latestArtifact(run, 'VerificationReport');
      if (!isReport(report)) throw new Error('report required');
      expect(report.status).toBe(status === 'passed' ? 'passed' : 'inconclusive');
      expect(report.candidates).toHaveLength(0);
    },
  );
  it('rejects execution approval after script, framework or target changes', async () => {
    const ports = verificationPorts();
    let run = verificationRun();
    for (let gate = 0; gate < 3; gate++) {
      run = await advanceRun(
        run,
        ports.agent,
        new AbortController().signal,
        () => {},
        () => {},
        ports.execution,
      );
      run = await approve(run);
    }
    run = await advanceRun(
      run,
      ports.agent,
      new AbortController().signal,
      () => {},
      () => {},
      ports.execution,
    );
    run.executionProfile!.targetUrl += '/changed';
    await expect(approve(run)).rejects.toThrow('approval_stale');
    expect(ports.calls).not.toContain('targets.execute');
  });
  it('rejects invented or uncovered case mappings before Python preflight', () => {
    expect(() =>
      decodeImplementation(
        { ...implementation, tests: [{ testName: 'test_probe', caseIds: ['missing'] }] },
        cases,
      ),
    ).toThrow('implementation_mapping_invalid');
    expect(() => decodeImplementation({ ...implementation, tests: [] }, cases)).toThrow();
  });
  it('rechecks upstream artifacts after execution approval and before starting Python', async () => {
    const ports = verificationPorts();
    let run = verificationRun();
    for (let gate = 0; gate < 4; gate++) {
      run = await advanceRun(
        run,
        ports.agent,
        new AbortController().signal,
        () => {},
        () => {},
        ports.execution,
      );
      run = await approve(run);
    }
    const caseArtifact = Object.values(run.artifacts).find((item) => item.type === 'TestCaseSet')!;
    caseArtifact.value = { ...cases, cases: [] };
    run = await advanceRun(
      run,
      ports.agent,
      new AbortController().signal,
      () => {},
      () => {},
      ports.execution,
    );
    expect(run.errorCode).toBe('execution_approval_stale');
    expect(ports.calls).not.toContain('targets.execute');
  });
  it('rejects an Agent claim of a defect against passing evidence', async () => {
    const plan = await fixturePlan();
    const evidence: EvidenceBundle = {
      executionId: plan.payload.executionId,
      planDigest: plan.digest,
      results: [{ testName: 'test_probe', status: 'passed', details: [] }],
      requests: [],
      rawEvidenceSha256: 'a'.repeat(64),
      resultSha256: 'b'.repeat(64),
      workspaceId: `${plan.payload.executionId}-execute`,
    };
    expect(() =>
      decodeVerdict(
        {
          candidates: [
            {
              id: 'C1',
              title: 'Invented',
              explanation: 'No failed test',
              testNames: ['test_probe'],
              caseIds: ['TC-1'],
            },
          ],
          notes: [],
        },
        evidence,
        implementation,
      ),
    ).toThrow('verdict_invalid');
  });
});
