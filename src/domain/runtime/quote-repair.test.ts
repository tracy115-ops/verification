import { expect, it } from 'vitest';
import { sourceQuote } from './source-quotes';
import { repairRequirementQuotes } from './quote-repair';
import { advanceRun, retryRun } from './engine';
import { fixtureRun, fixturePort, requirements, spec } from './fixtures.test-support';
import { taskFor } from './handlers';
import { decodeDesign } from './artifacts';
import { design } from './fixtures.test-support';

it('maps unique whitespace differences to original text without accepting paraphrases or ambiguity', () => {
  expect(sourceQuote('容量为 2\r\n  返回 201。', '容量为 2 返回 201。')).toBe('容量为 2\r\n  返回 201。');
  expect(() => sourceQuote('容量为2。', '容量为3。')).toThrow('source_quote_invalid');
  expect(() => sourceQuote('user a', 'usera')).toThrow('source_quote_invalid');
  expect(() => sourceQuote('A\nB 和 A  B', 'A B')).toThrow('source_quote_ambiguous');
  expect(() => sourceQuote(`A${' '.repeat(12000)}B`, 'A B')).toThrow('source_quote_invalid');
});

it('keeps factor source quotes aligned after whitespace restoration', () => {
  const baseline = {
    ...requirements,
    requirements: [{ ...requirements.requirements[0], quote: '失败  5次' }],
  };
  const generated = { ...design, factors: [{ ...design.factors[0], sourceQuote: '失败 5次' }] };
  expect(decodeDesign(generated, baseline).factors![0].sourceQuote).toBe('失败  5次');
  expect(generated.factors[0].sourceQuote).toBe('失败 5次');
});

it('retains rejected requirements and repairs only their quotes before mandatory human review', async () => {
  const generated = {
    ...requirements,
    requirements: [{ ...requirements.requirements[0], quote: '不存在的原文' }],
  };
  const failed = await advanceRun(
    fixtureRun(),
    fixturePort(generated).port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  expect(failed.errorCode).toBe('source_quote_invalid');
  const node = failed.plan.find((item) => item.operation === 'requirements.extract')!;
  const key = `${node.id}.${Object.keys(node.outputs)[0]}`;
  expect(failed.artifacts[key].value).toEqual(generated);
  const prompt = JSON.parse(taskFor(retryRun(failed), node, {}));
  expect(prompt.validationFeedback.examples[0].id).toBe('REQ-1');
  await expect(repairRequirementQuotes(failed, { 'REQ-1': '仍不存在' })).rejects.toThrow(
    'source_quote_invalid',
  );
  const repaired = await repairRequirementQuotes(failed, { 'REQ-1': spec });
  const port = fixturePort();
  const reviewed = await advanceRun(
    repaired,
    port.port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  expect(port.requests).toHaveLength(0);
  expect(reviewed.status).toBe('awaiting_review');
  expect(reviewed.id).toBe(failed.id);
  expect(reviewed.approvals).toHaveLength(0);
  expect(Object.values(reviewed.artifacts).some((item) => item.type === 'RequirementQuoteRepair')).toBe(true);
  expect(failed.artifacts[key].value).toEqual(generated);
});
