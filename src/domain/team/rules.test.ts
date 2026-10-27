import { expect, it } from 'vitest';
import { suggestAnalysis } from './suggestions';
import { checkAnalysis, decodeProject, factorCoverage, readiness } from './rules';
import { analysisPrompt } from './prompt';
import type { ProjectInput, TeamProject } from './types';

export const input: ProjectInput = {
  title: '黑盒登录题',
  mode: 'black_box',
  locale: 'zh-CN',
  topic: '只有题目，无源码。登录连续失败5次后锁定。',
  interfaces: [{ id: 'IF_1', name: '登录', contract: '失败5次后拒绝登录。' }],
};
const project = (): TeamProject => ({
  ...input,
  ...suggestAnalysis(input),
  formatVersion: 1,
  id: 'P_test',
  revision: 1,
  updatedAt: new Date().toISOString(),
  updatedBy: 'M_owner',
  comments: [],
});
it('generates explicitly unconfirmed black-box candidates without requiring source code', () => {
  const value = project();
  expect(value.factors).toHaveLength(6);
  expect(value.scenarios).toHaveLength(6);
  checkAnalysis(value, input);
  expect(value.factors.every((item) => item.basis === 'hypothesis')).toBe(true);
  expect(readiness(value.scenarios[0], value)).toEqual(['team_missing_oracle', 'team_missing_owner']);
  expect(factorCoverage(value, value.factors[0].id)).toEqual({ covered: 0, total: 7 });
  expect(analysisPrompt(value)).toContain('No source code is available or required');
});
it('rejects unknown levels, duplicate factors and fabricated explicit quotes', () => {
  const value = project();
  value.scenarios[0].factorValues[0].level = 'invented';
  expect(() => decodeProject(value)).toThrow('team_invalid');
  const duplicate = project();
  duplicate.factors.push(duplicate.factors[0]);
  expect(() => decodeProject(duplicate)).toThrow('team_invalid');
  const quote = project();
  quote.factors[0].basis = 'explicit';
  quote.factors[0].sourceQuote = 'invented contract';
  expect(() => decodeProject(quote)).toThrow('team_source_invalid');
});
it('requires a supplied source quote for contract-based expectations', () => {
  const value = project();
  const scenario = value.scenarios[0];
  scenario.oracle = '拒绝登录';
  scenario.oracleBasis = 'contract';
  scenario.ownerId = 'M_owner';
  expect(readiness(scenario, value)).toContain('team_source_invalid');
  scenario.sourceQuote = '失败5次后拒绝登录。';
  expect(readiness(scenario, value)).toEqual([]);
});
it('supports an unknown interface contract and long interface identifiers without inventing facts', () => {
  const topic = { ...input, interfaces: [{ id: 'I'.repeat(80), name: 'unknown', contract: '' }] };
  const analysis = suggestAnalysis(topic);
  checkAnalysis(analysis, topic);
  expect(analysis.scenarios.every((item) => item.oracleBasis === 'unknown')).toBe(true);
  checkAnalysis(suggestAnalysis({ ...input, interfaces: [] }), { ...input, interfaces: [] });
});
