export const preparationZh = {
  preparationTitle: '调用前检查',
  preparationBlocked: '配置待补齐',
  preparationReady: '本地配置齐备 · 能力待实际调用验证',
  preparation_spec_missing: '请先输入本次测试需求 Spec。',
  preparationScope: '保存版本 / 步骤数',
  preparationAgents: '本次节点实际使用的 Agent',
  preparationInherited: '继承 CLI 原生配置',
  preparationInternalModel: 'CLI 内置模型',
  preparationShortPassed: '当前配置短对话已通过；结构化流程能力未验证',
  preparationShortFailed: '当前配置短对话未通过，请检查登录和配置来源',
  preparationShortChecking: '当前配置短对话测试进行中',
  preparationShortUnknown: '当前配置尚未做短对话测试',
  preparationDesignOnly: '仅设计评审：本次不生成脚本、不执行测试',
  preparationTargetUnknown: '框架与目标地址格式已校验；Python 可用性与目标连通性将在执行阶段验证',
  preparationConfigure: '检查 Agent 配置',
  preparationWorkflow: '检查流程',
};

export const preparationEn: Record<keyof typeof preparationZh, string> = {
  preparationTitle: 'Before running',
  preparationBlocked: 'Configuration incomplete',
  preparationReady: 'Local configuration complete · capabilities await a real invocation',
  preparation_spec_missing: 'Enter the test requirements Spec first.',
  preparationScope: 'Saved revision / step count',
  preparationAgents: 'Agents actually used by these nodes',
  preparationInherited: 'Inherit native CLI configuration',
  preparationInternalModel: 'CLI built-in model',
  preparationShortPassed:
    'Current configuration passed a short chat; structured workflow capability is unverified',
  preparationShortFailed: 'Current configuration failed a short chat; check login and configuration source',
  preparationShortChecking: 'Short chat check in progress for this configuration',
  preparationShortUnknown: 'No short chat check for this configuration',
  preparationDesignOnly: 'Design review only: no script generation or test execution in this invocation',
  preparationTargetUnknown:
    'Framework and target address formats validated; Python availability and target connectivity await the execution stage',
  preparationConfigure: 'Check Agent configuration',
  preparationWorkflow: 'Check workflow',
};
