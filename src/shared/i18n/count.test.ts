import { expect, it } from 'vitest';
import { formatCount } from './count';

it('formats zero, singular and plural counters by locale', () => {
  expect(formatCount('en-US', 'nodes', 1)).toBe('1 node');
  expect(formatCount('en-US', 'agents', 0)).toBe('0 Agent nodes');
  expect(formatCount('en-US', 'reviews', 2)).toBe('2 human reviews');
  expect(formatCount('en-US', 'nodes', 1000)).toBe('1,000 nodes');
  expect(formatCount('zh-CN', 'nodes', 1)).toBe('1 个节点');
});
