export const designEditZh = {
  designClose: '关闭',
  designAdd: '人工新增',
  designEdit: '编辑',
  designEditor: '补充测试设计',
  designName: '名称',
  designRequirements: '关联需求（至少一项）',
  designLevels: '因子水平（每行一项）',
  designQuote: '原文依据',
  designDimension: '测试维度',
  designExpected: '预期结果',
  designReason: '修改说明',
  designSave: '保存并重新评审',
  designRevisionHint:
    '保存后重新评审场景覆盖。原有用例、脚本、审批和执行结果将归档，不再作为当前版本的覆盖证据。',
  designInvalid: '请补全字段；检查 ID、需求关联、原文引用及因子水平映射。最多保留 10 次设计修订。',
  designNoLevel: '不关联',
  agentApi: 'Agent 接口接入',
  agentApiHint:
    '为 Agent 创建独立成员令牌，通过环境变量传入。先读取最新项目，再提交增量建议；审核合入后团队同步。这里不展示登录令牌。',
};
export const designEditEn = {
  designClose: 'Close',
  designAdd: 'Add manually',
  designEdit: 'Edit',
  designEditor: 'Extend test design',
  designName: 'Name',
  designRequirements: 'Linked requirements (at least one)',
  designLevels: 'Factor levels (one per line)',
  designQuote: 'Source evidence',
  designDimension: 'Test dimension',
  designExpected: 'Expected result',
  designReason: 'Reason for change',
  designSave: 'Save for review',
  designRevisionHint:
    'Saving reopens coverage review. Existing cases, scripts, approvals and execution results are archived and no longer count as current coverage evidence.',
  designInvalid:
    'Complete all fields; check IDs, requirement links, exact quotes and factor mappings. At most 10 design revisions are retained.',
  designNoLevel: 'Unlinked',
  agentApi: 'Agent API integration',
  agentApiHint:
    'Create a separate member token for the Agent and pass it through an environment variable. Read the latest project before submitting incremental suggestions. Reviewed merges synchronize to the team. Login tokens are not displayed here.',
};
