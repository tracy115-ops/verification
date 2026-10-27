import { createDocument } from '../document';
import type { AgentPort, TurnRequest } from './types';
import { createRun } from './plan';

export const spec = '账户连续失败5次后锁定。';
export const requirements = {
  requirements: [{ id: 'REQ-1', text: spec, quote: spec, acceptanceCriteria: ['第5次失败锁定'] }],
  questions: [] as string[],
};
export const design = {
  strategy: '边界验证',
  scenarios: [
    { id: 'SC-1', title: '第五次失败', requirementIds: ['REQ-1'], dimension: 'boundary', expected: '锁定' },
  ],
  gaps: [] as string[],
};
export const cases = {
  cases: [
    {
      id: 'TC-1',
      title: '失败锁定',
      scenarioIds: ['SC-1'],
      requirementIds: ['REQ-1'],
      preconditions: [],
      steps: ['连续失败5次'],
      expected: '锁定',
      assertions: ['锁定标记为真'],
    },
  ],
};
export function savedDocument() {
  const doc = createDocument();
  doc.revision = 1;
  return doc;
}
export function fixtureRun() {
  const doc = savedDocument();
  return createRun(doc, crypto.randomUUID(), spec, doc.profiles, 'codex-native');
}
export function fixturePort(output?: unknown) {
  const requests: TurnRequest[] = [];
  const port: AgentPort = {
    async send(request, onEvent, signal) {
      requests.push(request);
      if (signal.aborted)
        return { status: 'cancelled', text: '', errorCode: 'cancelled', nativeSessionId: null };
      onEvent({ type: 'text', text: 'fixture' });
      const operation = JSON.parse(request.prompt).operation;
      const value =
        output ??
        (
          {
            'requirements.extract': requirements,
            'scenarios.design': design,
            'cases.generate': cases,
          } as Record<string, unknown>
        )[operation];
      return {
        status: 'completed',
        text: JSON.stringify(value ?? { reply: 'fixture' }),
        errorCode: null,
        nativeSessionId: null,
      };
    },
    async cancel() {},
  };
  return { port, requests };
}
