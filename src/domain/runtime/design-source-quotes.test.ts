import { expect, it } from 'vitest';
import { decodeDesign } from './artifacts';
import { designQuoteIssues } from './design-source-quotes';
import { design, requirements, fixtureRun, fixturePort } from './fixtures.test-support';
import { advanceRun, approveRun, retryRun } from './engine';
import { taskFor } from './handlers';
import { decodeConversations } from '../../services/conversation-repository';

it('rejects a source paragraph outside the linked requirement span without widening the links', () => {
  const value = structuredClone(design);
  value.factors![0].sourceQuote = `Context. ${requirements.requirements[0].quote}`;
  expect(() => decodeDesign(value, requirements)).toThrow('design_factor_quote_invalid');
  expect(designQuoteIssues(value, requirements)).toEqual([
    { factorId: value.factors![0].id, requirementIds: value.factors![0].requirementIds },
  ]);
  value.factors![0].sourceQuote = requirements.requirements[0].quote;
  expect(decodeDesign(value, requirements).scenarios).toEqual(design.scenarios);
  expect(designQuoteIssues(value, requirements)).toEqual([]);
  expect(designQuoteIssues({ arbitrary: true }, requirements)).toEqual([]);
});

it('retains source-quote diagnostics across reload and includes them only on explicit retry', async () => {
  const initial = await advanceRun(
    fixtureRun(),
    fixturePort().port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  const review = initial.plan.find((node) => node.operation === 'review.requirements')!;
  const ready = await approveRun(initial, review.id, initial.steps[review.id].reviewDigest!);
  const invalid = structuredClone(design);
  invalid.factors![0].sourceQuote = 'Context outside the linked quote';
  const failed = await advanceRun(
    ready,
    fixturePort(invalid).port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  const node = failed.plan.find((node) => node.operation === 'scenarios.design')!;
  expect(failed.errorCode).toBe('design_factor_quote_invalid');
  expect(failed.steps[node.id].designQuoteIssues).toHaveLength(1);
  expect(Object.values(failed.artifacts).some((a) => a.type === 'TestDesignDraft')).toBe(false);
  const session = {
    id: failed.sessionId,
    title: 'quote recovery',
    profileId: 'codex-native',
    messages: [],
    runs: [failed],
  };
  const reloaded = decodeConversations(JSON.parse(JSON.stringify([session])))[0].runs[0];
  const retry = retryRun(reloaded);
  const feedback = JSON.parse(taskFor(retry, node, {})).sourceQuoteFeedback;
  expect(feedback.issues).toEqual(failed.steps[node.id].designQuoteIssues);
  expect(feedback.instruction).toContain('never add unrelated requirement IDs');
  const recovered = await advanceRun(
    retry,
    fixturePort(design).port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  expect(recovered.status).toBe('awaiting_review');
  expect(recovered.steps[node.id].designQuoteIssues).toBeUndefined();
  expect(recovered.approvals).toEqual(failed.approvals);
  session.runs[0].steps[review.id].designQuoteIssues = failed.steps[node.id].designQuoteIssues;
  expect(() => decodeConversations([session])).toThrow('session_storage_invalid');
});
