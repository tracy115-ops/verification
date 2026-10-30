export const quoteRepairZh = {
  quoteRepairAppliedLabel: '引用已修复',
  quoteRepairApplied: '原始回复的引用曾未通过校验；任务引用现已人工修复，原始记录和修复审计保留。',
  quoteRepairTitle: '修复原文引用',
  quoteRepairHint:
    '已保留生成结果。只修改引用，保存后进入需求评审，无需重新调用 CLI；引用必须能在原文唯一定位。',
  quoteRepairLoading: '正在读取本次生成结果…',
  quoteRepairUnavailable: '未找到可恢复的结构化结果，请在对话中查看本次 CLI 原始回复。',
  quoteRepairItem: '选择待修复需求',
  quoteRepairQuote: '原文引用（从 Spec 原样复制）',
  quoteRepairSource: '查看原始 Spec',
  quoteRepairSave: '保存引用并进入需求评审',
  quoteRepairFormatting: '引用可通过格式校正恢复，请确认后继续。',
};
export const quoteRepairEn: Record<keyof typeof quoteRepairZh, string> = {
  quoteRepairAppliedLabel: 'Quotes repaired',
  quoteRepairApplied:
    'Quotes in the original reply failed validation. Task quotes were repaired manually; the original record and repair audit are retained.',
  quoteRepairTitle: 'Repair source quotes',
  quoteRepairHint:
    'Generated content is retained. Edit quotes and proceed to requirements review without another CLI call. Each quote must uniquely match the source.',
  quoteRepairLoading: 'Loading the generated result…',
  quoteRepairUnavailable:
    'No recoverable structured result was found. Inspect the raw CLI reply in the conversation.',
  quoteRepairItem: 'Requirement to repair',
  quoteRepairQuote: 'Source quote (copy verbatim from Spec)',
  quoteRepairSource: 'View original Spec',
  quoteRepairSave: 'Save quotes and review requirements',
  quoteRepairFormatting: 'Formatting normalization can recover these quotes. Confirm to continue.',
};
