export const designQualityZh = {
  qualityTitle: '设计缺口检查',
  qualityHint:
    '按已声明的因子水平和关联关系检查；不代表组合覆盖充分或已验证业务正确性。请继续评审边界、状态转换、权限、并发、失败恢复和可观测判定依据。',
  qualityLevels: '有场景的因子水平',
  qualityScenarios: '有用例的场景',
  qualityLevel: '因子水平尚无场景',
  qualityScenario: '场景尚无用例',
  qualityQuestion: '需求问题',
  qualityGap: '设计问题',
  qualityPendingCases: '用例尚未生成，场景待承接。',
  qualityNone: '未发现上述结构缺口；仍需进行业务深度评审。',
  qualityOpen: '待处理',
  qualityPending: '待生成',
  qualityDecided: '已处理',
  qualityAnswered: '已澄清',
  qualityExcluded: '已记录排除原因',
  qualityFilterEmpty: '此分类暂无条目。',
  qualityRequirementScenarios: '需求尚无场景',
  qualityRequirementCases: '需求尚无直接关联用例',
  qualityDecisionsHint: '澄清和排除单独记录，不计入场景或用例覆盖数量。设计变更后需要重新评审。',
  qualityRepair: '围绕这些缺口补充设计',
  qualityRepairHint:
    '将缺口带回会话，选择 Agent 后发送。只生成修改提议，审核合入后才更新设计。现有输入会保留。',
  qualityRepairPrompt:
    '请针对以下当前任务的设计缺口，提出必要的因子或场景增量修改。保留原文依据和无关设计；预期不明确时提出问题，不要编造规则，不要把尚未生成用例当作设计缺陷。',
  qualityRepairFocus: '待补充项目（本次最多 10 项预览；完整原文和设计在任务上下文中，其余缺口保留）：',
  qualityRepairFailed:
    '当前任务已变化、正在调用 Agent，或合并后输入过长。原输入已保留，请返回会话检查后重试。',
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
  qualityOpen: 'Needs attention',
  qualityPending: 'Awaiting generation',
  qualityDecided: 'Decisions recorded',
  qualityAnswered: 'Clarified',
  qualityExcluded: 'Exclusion reason recorded',
  qualityFilterEmpty: 'No items in this category.',
  qualityRequirementScenarios: 'Requirement without scenarios',
  qualityRequirementCases: 'Requirement without directly linked cases',
  qualityDecisionsHint:
    'Clarifications and exclusions are recorded separately; they never increase coverage counts. Design changes require a new review.',
  qualityRepair: 'Improve design for these gaps',
  qualityRepairHint:
    'Bring these gaps into the conversation, choose an Agent and send. Only a change proposal is generated; the design changes after review and merge. Existing input is preserved.',
  qualityRepairPrompt:
    'Propose necessary incremental factor or scenario changes for the current task gaps below. Preserve source evidence and unrelated design. Ask questions when expected behavior is unspecified; never invent rules or treat cases awaiting generation as design defects.',
  qualityRepairFocus:
    'Items to address (up to 10 previews; full source and design are in the task context; retain other gaps):',
  qualityRepairFailed:
    'The task changed, an Agent is running, or the combined input is too long. Existing input is preserved. Return to the conversation and retry.',
};
