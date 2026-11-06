export const runZh = {
  candidateTraceTitle: '候选问题证据链',
  candidateEvidenceTab: '执行证据',
  candidateCasesTab: '用例与原文',
  candidateAnalysisTab: 'Agent 分析',
  candidateScriptTab: '执行时脚本',
  candidatePreconditions: '前置条件',
  candidateReportNotes: '报告备注与验证范围',
  candidateTestMethod: '关联测试方法',
  candidateNone: '本次报告没有候选缺陷；请结合报告状态和备注判断结论。',
  candidateEvidenceUnavailable:
    '找不到此报告对应的原始证据或执行计划。不会用其他运行的结果替代，请检查历史产物是否完整。',
  candidateTraceIncomplete: '部分测试方法或用例关联缺失，请先核对引用；当前只展示能准确关联的记录。',
  candidateAnalysisHint: 'Agent 分析是待复核的判断；是否构成缺陷需结合原文和实际执行证据确认。',
  runReviewBudgetPaused: '等待人工评审期间暂停流程计时，确认后继续。',
  runAwaitingReport: '已有执行证据，最终报告尚未生成；可打开执行节点产物查看原始结果。',
  runPurpose: '跨会话查看流程进度、待处理步骤与产物；流程完成不等于测试通过。',
  runSearch: '搜索会话、流程名称或运行 ID',
  runFilter: '筛选运行状态',
  runAll: '全部运行',
  runAttention: '需要处理',
  runIdentifier: '运行 ID',
  runHandle: '去会话处理',
  runRecordedCliTime: '已记录的 CLI 用时（不含人工评审与测试执行）',
  runSeconds: '{seconds} 秒',
  runTimeUnknown: '未记录',
  runDesignOnly: '本次仅进行测试设计；未执行测试。产物可逐节点打开核对。',
};
export const runEn = {
  candidateTraceTitle: 'Candidate evidence trail',
  candidateEvidenceTab: 'Execution evidence',
  candidateCasesTab: 'Cases and source',
  candidateAnalysisTab: 'Agent analysis',
  candidateScriptTab: 'Executed script',
  candidatePreconditions: 'Preconditions',
  candidateReportNotes: 'Report notes and verification scope',
  candidateTestMethod: 'Linked test method',
  candidateNone:
    'This report has no defect candidates. Check its status and notes before drawing conclusions.',
  candidateEvidenceUnavailable:
    'The original evidence or execution plan for this report is missing. Results from another run will not be substituted. Check the historical artifacts.',
  candidateTraceIncomplete:
    'Some test or case references are missing. Verify the links; only exact matches are displayed.',
  candidateAnalysisHint:
    'Agent analysis requires review. Confirm potential defects against the source and execution evidence.',
  runReviewBudgetPaused: 'The workflow timer is paused for human review and resumes after approval.',
  runAwaitingReport:
    'Execution evidence is available; the final report has not been generated. Open the execution artifact to inspect results.',
  runPurpose:
    'Inspect cross-conversation progress, attention points and artifacts. Workflow completion does not mean tests passed.',
  runSearch: 'Search conversations, workflows or run IDs',
  runFilter: 'Filter run status',
  runAll: 'All runs',
  runAttention: 'Needs attention',
  runIdentifier: 'Run ID',
  runHandle: 'Handle in conversation',
  runRecordedCliTime: 'Recorded CLI time (excludes human review and test execution)',
  runSeconds: '{seconds} seconds',
  runTimeUnknown: 'Not recorded',
  runDesignOnly:
    'This run covers test design only; no tests were executed. Open individual node artifacts to inspect them.',
};
