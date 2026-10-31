import { readFileSync } from 'node:fs';
import { exampleFramework } from '../../src/domain/execution/presets';
import { createDocument } from '../../src/domain/document';
import { createRun } from '../../src/domain/runtime/plan';
import type { AgentPort, CaseArtifact, WorkflowRun } from '../../src/domain/runtime/types';
import { latestArtifact } from '../../src/domain/runtime/bindings';
import { decodeEvidence, decodePlan } from '../../src/domain/execution/validation';

interface Archive {
  coverage: { requirementId: string; method: string; testNames: string[] }[];
}
export function gameWorkflowFixture(targetUrl: string) {
  const source = readFileSync('docs/examples/game-platform-blackbox-topic.md', 'utf8');
  const archive: Archive = JSON.parse(
    readFileSync('docs/examples/generated/game-platform/report.json', 'utf8'),
  );
  const script = readFileSync('docs/examples/generated/game-platform/test_game_platform.py', 'utf8');
  const quotePrefixes: Record<string, string> = {
    'ROOM-CAPACITY': '`POST /rooms`',
    'ROOM-MODE-RANKED': '`POST /rooms`',
    'ROOM-PRIVATE-ACCESS': '`GET /rooms/private-room`',
    'ROOM-JOIN-CAPACITY': '`POST /rooms/race-room/join`',
    'MATCH-LIVE': '`POST /matches/live/actions`',
    'MATCH-FINISHED': '`POST /matches/finished/actions`',
    'RESULT-SCORING': '`POST /matches/result/result`',
    'QUEUE-INPUT': '`POST /queue`',
    'QUEUE-DEPENDENCY': '`POST /queue`',
  };
  const quotes = archive.coverage.map((item) => {
    if (item.requirementId.endsWith('AUTHENTICATION')) return '所有接口无身份返回 401。';
    const prefix = quotePrefixes[item.requirementId];
    const quote = source.split(/\r?\n\r?\n/).find((paragraph) => prefix && paragraph.startsWith(prefix));
    if (!quote) throw new Error('Missing interface source quote in replay fixture');
    return quote;
  });
  const requirements = {
    requirements: archive.coverage.map((item, i) => ({
      id: `REQ-${i + 1}`,
      text: item.requirementId,
      quote: quotes[i],
      acceptanceCriteria: [item.method],
    })),
    questions: [],
  };
  const design = {
    strategy: 'Replay approved black-box design fixtures with real Python execution.',
    factors: archive.coverage.map((item, i) => ({
      id: `F-${i + 1}`,
      name: item.requirementId,
      requirementIds: [`REQ-${i + 1}`],
      levels: [item.method],
      sourceQuote: quotes[i],
    })),
    scenarios: archive.coverage.map((item, i) => ({
      id: `SC-${i + 1}`,
      title: item.requirementId,
      requirementIds: [`REQ-${i + 1}`],
      dimension: item.method,
      expected: 'Assert only the corresponding documented interface behavior.',
      factorLevels: [{ factorId: `F-${i + 1}`, level: item.method }],
    })),
    gaps: [],
  };
  const cases: CaseArtifact = {
    cases: archive.coverage.map((item, i) => ({
      id: `TC-${i + 1}`,
      title: item.requirementId,
      scenarioIds: [`SC-${i + 1}`],
      requirementIds: [`REQ-${i + 1}`],
      preconditions: ['A fresh game fixture per method.'],
      steps: [item.method],
      expected: 'Topic-defined observable result',
      assertions: [item.method],
    })),
  };
  const mappings = new Map<string, string[]>();
  archive.coverage.forEach((item, i) =>
    item.testNames.forEach((name) =>
      mappings.set(name, [...(mappings.get(name) ?? []), `B${Math.floor(i / 3) + 1}-TC-${i + 1}`]),
    ),
  );
  const approvedCases = cases.cases.map((item, i) => ({
    ...item,
    id: `B${Math.floor(i / 3) + 1}-${item.id}`,
  }));
  const implementation = {
    script,
    tests: [...mappings].map(([testName, caseIds]) => ({ testName, caseIds })),
    questions: [],
  };
  const document = createDocument();
  document.revision = 1;
  document.profiles = document.profiles.map((item) =>
    item.driver === 'codeagent' ? item : { ...item, model: 'offline-replay' },
  );
  const run = createRun(document, crypto.randomUUID(), source, document.profiles, 'codex-native', {
    ...exampleFramework(),
    targetUrl,
  });
  let current: WorkflowRun = run;
  const operations: string[] = [];
  const agent: AgentPort = {
    async send(request) {
      const { operation, batch } = JSON.parse(request.prompt);
      operations.push(operation);
      let value: unknown = (
        {
          'requirements.extract': requirements,
          'scenarios.design': design,
          'cases.generate': cases,
          'tests.implement': implementation,
        } as Record<string, unknown>
      )[operation];
      if (operation === 'cases.generate')
        value = {
          cases: cases.cases.filter((item) =>
            item.scenarioIds.some((id) => batch.allowedScenarioIds.includes(id)),
          ),
        };
      if (operation === 'verdicts.evaluate') {
        const plan = decodePlan(latestArtifact(current, 'ExecutionPlan'));
        const evidence = decodeEvidence(latestArtifact(current, 'EvidenceBundle'), plan);
        const failed = new Set(
          evidence.results.filter((item) => item.status === 'failed').map((item) => item.testName),
        );
        value = {
          candidates: approvedCases.flatMap((item) => {
            const tests = implementation.tests.filter(
              (mapping) => mapping.caseIds.includes(item.id) && failed.has(mapping.testName),
            );
            return tests.length
              ? [
                  {
                    id: `CAND-${item.id}`,
                    title: item.title,
                    explanation:
                      'Failed assertions against the documented game interface; human reproduction required.',
                    testNames: tests.map((item) => item.testName),
                    caseIds: [...new Set(tests.flatMap((item) => item.caseIds))],
                  },
                ]
              : [];
          }),
          notes: [
            'Design and Agent responses replay reviewed fixtures; Python process, HTTP calls and evidence are real.',
          ],
        };
      }
      return { status: 'completed', text: JSON.stringify(value), errorCode: null, nativeSessionId: null };
    },
    async cancel() {},
  };
  return {
    run,
    agent,
    operations,
    update(value: WorkflowRun) {
      current = value;
    },
  };
}
