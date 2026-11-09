export const designQualityZh = {
  qualityTitle: '设计缺口检查',
  qualityHint:
    '按已声明的因子水平和关联关系检查；不代表组合覆盖充分或已验证业务正确性。请继续评审边界、状态转换、权限、并发、失败恢复和可观测判定依据。',
  qualityLevels: '有场景的因子水平',
  qualityScenarios: '有用例的场景',
  qualityLevel: '因子水平尚无场景',
  qualityScenario: '场景尚无用例',
  qualityQuestion: '需求待澄清',
  qualityGap: '设计待补充',
  qualityPendingCases: '用例尚未生成，场景待承接。',
  qualityNone: '未发现上述结构缺口；仍需进行业务深度评审。',
};
export const designQualityEn: Record<keyof typeof designQualityZh, string> = {
  qualityTitle: 'Design gap checks',
  qualityHint:
    'Checks declared factor levels and links only; this does not certify combination coverage or business correctness. Review boundaries, state transitions, permissions, concurrency, failure recovery and observable oracles.',
  qualityLevels: 'Factor levels with scenarios',
  qualityScenarios: 'Scenarios with cases',
  qualityLevel: 'Factor level without a scenario',
  qualityScenario: 'Scenario without a case',
  qualityQuestion: 'Requirement question',
  qualityGap: 'Design gap',
  qualityPendingCases: 'Cases have not been generated; scenarios still need cases.',
  qualityNone: 'No structural gaps found in these checks. Business depth still needs review.',
};
