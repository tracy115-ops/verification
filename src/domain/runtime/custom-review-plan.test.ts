import { expect, it } from 'vitest';
import { addReview } from '../document';
import { savedDocument } from './fixtures.test-support';
import { selectRunPlan } from './plan';

it('keeps added design-path reviews and their review chains, without including execution-only reviews', () => {
  let doc = savedDocument();
  const terminal = doc.definition.nodes.find((item) => item.operation === 'review.cases')!;
  doc = addReview(doc, terminal.id);
  const first = doc.definition.nodes.at(-1)!.id;
  doc = addReview(doc, first);
  const second = doc.definition.nodes.at(-1)!.id;
  const execution = doc.definition.nodes.find((item) => item.operation === 'targets.execute')!;
  doc = addReview(doc, execution.id);
  const executionReview = doc.definition.nodes.at(-1)!.id;
  const ids = selectRunPlan(doc, false).map((item) => item.id);
  expect(ids).toContain(first);
  expect(ids).toContain(second);
  expect(ids).not.toContain(executionReview);
  expect(selectRunPlan(doc, true).map((item) => item.id)).toContain(executionReview);
});
