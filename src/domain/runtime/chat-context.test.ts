import { expect, it } from 'vitest';
import { chatContext } from './chat-context';
import { taskFor } from './handlers';
import { fixtureRun } from './fixtures.test-support';

it('bounds recent history without cutting the latest message or changing records', () => {
  const messages = [
    { role: 'user' as const, text: '旧文档'.repeat(10000), status: 'complete' as const },
    { role: 'user' as const, text: '你好', status: 'complete' as const },
  ];
  expect(chatContext(messages).messages).toEqual([{ role: 'user', text: '你好' }]);
  expect(chatContext(messages).omitted).toBe(1);
  expect(chatContext(messages, 'full').messages).toHaveLength(2);
  expect(chatContext(messages, 'current').messages).toHaveLength(1);
  expect(chatContext(messages.slice(0, 1)).messages[0].text).toBe(messages[0].text);
  expect(messages).toHaveLength(2);
  expect(
    chatContext([messages[0], { role: 'assistant', text: '旧回复', status: 'complete' }, messages[1]])
      .messages,
  ).toEqual([{ role: 'user', text: '你好' }]);
});

it('sends duplicate source Spec once while preserving original workflow inputs', () => {
  const run = fixtureRun();
  const node = run.plan.find((item) => item.operation === 'requirements.extract')!;
  const key = Object.keys(node.inputs).find((key) => node.inputs[key].type === 'DocumentRevision')!;
  const inputs = { [key]: { text: run.spec, revision: 1 } };
  const prompt = JSON.parse(taskFor(run, node, inputs));
  expect(prompt.sourceSpec).toBe(run.spec);
  expect(prompt.inputs[key]).toEqual({ revision: 1, sourceTextField: 'sourceSpec' });
  expect(inputs[key].text).toBe(run.spec);
});
