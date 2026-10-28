import { digest } from '../runtime/plan';
import { savedDocument, requirements, design, cases } from '../runtime/fixtures.test-support';
import { createRun } from '../runtime/plan';
import { spec } from '../runtime/fixtures.test-support';
import { exampleFramework } from './presets';
import type { AgentPort } from '../runtime/types';
import type { ExecutionPlan, ExecutionPort, ImplementationBundle, EvidenceBundle } from './types';

export const implementation: ImplementationBundle = {
  script:
    'from framework import BlackBoxCase\nclass Tests(BlackBoxCase):\n    def test_probe(self):\n        response = self.client.call("GET", "/probe")\n        self.assertEqual(response.status, 200)\n',
  tests: [{ testName: 'test_probe', caseIds: ['TC-1'] }],
  questions: [],
};
export function verificationRun() {
  const doc = savedDocument();
  return createRun(doc, crypto.randomUUID(), spec, doc.profiles, 'codex-native', exampleFramework());
}
export function verificationPorts(status: EvidenceBundle['results'][number]['status'] = 'failed') {
  const calls: string[] = [];
  const agent: AgentPort = {
    async send(request) {
      const { operation } = JSON.parse(request.prompt);
      calls.push(operation);
      const verdict = {
        candidates:
          status === 'failed'
            ? [
                {
                  id: 'CAND-1',
                  title: 'Candidate assertion failure',
                  explanation: 'Actual response violates the supplied oracle.',
                  testNames: ['test_probe'],
                  caseIds: ['TC-1'],
                },
              ]
            : [],
        notes: [],
      };
      const value = (
        {
          'requirements.extract': requirements,
          'scenarios.design': design,
          'cases.generate': cases,
          'tests.implement': implementation,
          'verdicts.evaluate': verdict,
        } as Record<string, unknown>
      )[operation];
      return { status: 'completed', text: JSON.stringify(value), errorCode: null, nativeSessionId: null };
    },
    async cancel() {},
  };
  const execution: ExecutionPort = {
    async preflight(payload) {
      calls.push('targets.preflight');
      return {
        digest: await digest(payload),
        scriptSha256: await digest(payload.implementation.script),
        frameworkSha256: await digest(payload.profile.frameworkSource),
        pythonVersion: '3.11.15',
        testNames: ['test_probe'],
        payload: structuredClone(payload),
      };
    },
    async execute(plan) {
      calls.push('targets.execute');
      return {
        executionId: plan.payload.executionId,
        planDigest: plan.digest,
        results: [{ testName: 'test_probe', status, details: status === 'passed' ? [] : ['fixture result'] }],
        requests: [],
        rawEvidenceSha256: 'a'.repeat(64),
        resultSha256: 'b'.repeat(64),
        workspaceId: `${plan.payload.executionId}-execute`,
      };
    },
    async cancel() {},
  };
  return { agent, execution, calls };
}
export async function fixturePlan(): Promise<ExecutionPlan> {
  const run = verificationRun();
  return verificationPorts().execution.preflight(
    {
      sessionId: run.sessionId,
      runId: run.id,
      executionId: crypto.randomUUID(),
      profile: run.executionProfile!,
      implementation,
    },
    new AbortController().signal,
  );
}
