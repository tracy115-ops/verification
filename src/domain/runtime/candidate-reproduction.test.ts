import { expect, it } from 'vitest';
import { reportRunFixture } from '../../../tests/fixtures/report-run';
import { candidateReproduction } from './candidate-reproduction';
import { frameworkSha256 } from '../execution/framework-modules';
import type {
  EvidenceBundle,
  ExecutionPlan,
  ImplementationBundle,
  VerificationReport,
} from '../execution/types';

function setup() {
  const run = reportRunFixture();
  const artifact = Object.values(run.artifacts).find((item) => item.type === 'VerificationReport')!;
  return {
    run,
    digest: artifact.digest,
    candidateId: (artifact.value as VerificationReport).candidates[0].id,
  };
}
it('exports the exact complete suite, framework, source and matching evidence without CLI profiles', async () => {
  const { run, digest, candidateId } = setup();
  const original = structuredClone(run);
  run.snapshot.profiles[0].model = 'PRIVATE_PROVIDER_CANARY';
  const bundle = await candidateReproduction(run, digest, candidateId);
  expect(bundle.kind).toBe('candidate-reproduction');
  expect(bundle.scope).toBe('approved-suite');
  expect(bundle.implementation.tests).toHaveLength(4);
  expect(bundle.candidate.testNames).toHaveLength(1);
  expect(bundle.execution.evidence.executionId).toBe(bundle.execution.executionId);
  expect(bundle.execution.evidence.planDigest).toBe(bundle.execution.planDigest);
  expect(bundle.source.spec).toBe(run.spec);
  expect(bundle.source.cases.cases).toHaveLength(4);
  expect(JSON.stringify(bundle)).not.toContain('PRIVATE_PROVIDER_CANARY');
  expect(bundle).not.toHaveProperty('profiles');
  expect(bundle).not.toHaveProperty('snapshot');
  run.snapshot = original.snapshot;
  expect(run).toEqual(original);
});
it.each(['missing-evidence', 'execution-id', 'framework-hash', 'script-hash', 'counts'])(
  'rejects %s instead of exporting a mixed reproduction',
  async (variant) => {
    const { run, digest, candidateId } = setup();
    const pick = (type: string) => Object.values(run.artifacts).find((item) => item.type === type)!;
    if (variant === 'missing-evidence') {
      for (const [key, artifact] of Object.entries(run.artifacts))
        if (artifact.type === 'EvidenceBundle') delete run.artifacts[key];
    }
    if (variant === 'execution-id')
      (pick('EvidenceBundle').value as EvidenceBundle).executionId = crypto.randomUUID();
    if (variant === 'framework-hash')
      (pick('ExecutionPlan').value as ExecutionPlan).frameworkSha256 = '0'.repeat(64);
    if (variant === 'script-hash')
      (pick('ExecutionPlan').value as ExecutionPlan).scriptSha256 = '0'.repeat(64);
    if (variant === 'counts') (pick('VerificationReport').value as VerificationReport).counts.failed = 0;
    await expect(candidateReproduction(run, digest, candidateId)).rejects.toThrow(
      'candidate_reproduction_unavailable',
    );
  },
);
it('exports the approved SDK snapshot and rejects changed module content', async () => {
  const { run, digest, candidateId } = setup();
  const plan = Object.values(run.artifacts).find((item) => item.type === 'ExecutionPlan')!
    .value as ExecutionPlan;
  const profile = plan.payload.profile;
  profile.frameworkModules = [{ path: 'sdk/client.py', source: '# original SDK\n' }];
  plan.frameworkSha256 = await frameworkSha256(profile);
  const bundle = await candidateReproduction(run, digest, candidateId);
  expect(bundle.framework.frameworkModules).toEqual(profile.frameworkModules);
  profile.frameworkModules[0].source = '# changed SDK\n';
  await expect(candidateReproduction(run, digest, candidateId)).rejects.toThrow(
    'candidate_reproduction_unavailable',
  );
});
it('snapshots export inputs before asynchronous hashing and rejects stale report selections', async () => {
  const { run, digest, candidateId } = setup();
  await expect(candidateReproduction(run, 'different-report', candidateId)).rejects.toThrow(
    'candidate_reproduction_unavailable',
  );
  const pending = candidateReproduction(run, digest, candidateId);
  const implementation = Object.values(run.artifacts).find((item) => item.type === 'ImplementationBundle')!
    .value as ImplementationBundle;
  const script = implementation.script;
  implementation.script = 'Changed after clicking export';
  expect((await pending).implementation.script).toBe(script);
});
