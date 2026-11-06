import { readFileSync } from 'node:fs';
import type { WorkflowRun } from '../../src/domain/runtime/types';
import type { ExecutionPlan } from '../../src/domain/execution/types';

// Persistence fixture assembled around real archived native results; no live inference.
export function reportRunFixture(): WorkflowRun {
  const root = new URL('../../docs/examples/generated/native-desktop-2026-11-06/', import.meta.url);
  const read = (name: string): unknown => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
  const run = JSON.parse(
    readFileSync(
      new URL('../../docs/examples/generated/cli-transcript-2026-10-28/run.json', import.meta.url),
      'utf8',
    ),
  ) as WorkflowRun;
  const plan = read('execution-plan.json') as ExecutionPlan;
  run.id = plan.payload.runId;
  run.sessionId = plan.payload.sessionId;
  run.spec = readFileSync(new URL('source.txt', root), 'utf8');
  run.scope = 'verification';
  run.executionProfile = plan.payload.profile;
  run.plan = structuredClone(run.snapshot.definition.nodes);
  run.steps = Object.fromEntries(run.plan.map((node) => [node.id, { status: 'succeeded', attempts: 1 }]));
  const report = read('report.json') as { evidenceDigest: string };
  const values: Record<string, unknown> = {
    DocumentRevision: { text: run.spec, revision: 1 },
    RequirementBaselineDraft: read('requirements.json'),
    RequirementBaseline: read('requirements.json'),
    TestDesignDraft: read('design.json'),
    TestDesign: read('design.json'),
    TestCaseSetDraft: read('cases.json'),
    TestCaseSet: read('cases.json'),
    ImplementationBundle: read('implementation.json'),
    ExecutionPlan: plan,
    ExecutionAuthorization: { planDigest: plan.digest, reviewDigest: 'fixture' },
    EvidenceBundle: read('evidence.redacted.json'),
    VerificationReport: report,
  };
  run.artifacts = Object.fromEntries(
    run.plan.flatMap((node) =>
      Object.entries(node.outputs).flatMap(([slot, type]) =>
        values[type]
          ? [
              [
                `${node.id}.${slot}`,
                {
                  type,
                  value: values[type],
                  digest: 'fixture-artifact-wrapper',
                },
              ],
            ]
          : [],
      ),
    ),
  );
  return run;
}
