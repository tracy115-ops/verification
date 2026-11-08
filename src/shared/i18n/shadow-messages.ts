export const shadowZh = {
  shadowTitle: '本机数据保护副本',
  shadowRetentionHint:
    '清空或导入当前个人数据不会删除保护副本。副本独立保存在本机，创建新副本时轮换最近两份。',
  shadowHint:
    '保存并校验当前已保存的个人数据，保留最近两份本机副本。日常读取仍使用现有数据；此处不自动迁移或恢复，副本也不代表当前最新状态。',
  shadowCreate: '创建并校验副本',
  shadowCheck: '重新校验已存副本',
  shadowExport: '导出最近副本用于恢复',
  shadow_missing: '该副本已被轮换，请重新校验并选择当前副本。',
  shadowDesktop: '数据保护副本仅在桌面应用可用；浏览器可导出个人数据。',
  shadowVerified: '已保存副本的完整性校验通过',
  shadowEmpty: '尚无数据保护副本',
  shadowCreated: '最近快照时间',
  shadowRecords: '会话 / CLI 记录',
  shadowBytes: '最近快照字节数',
  shadowRetained: '保留副本数',
  shadow_unavailable: '无法读写保护副本。请检查磁盘空间和目录权限；现有个人数据未切换。',
  shadow_corrupt: '保护副本损坏或摘要不匹配，已停止写入并保留文件。请先导出现有个人数据，再排查副本。',
  shadow_version: '保护副本版本不兼容，已保留文件；请使用兼容的应用版本检查。',
  shadow_limit: '保护副本超过存储上限，已停止写入；请先导出个人数据并检查副本文件。',
  shadow_invalid: '保护副本返回的数据或摘要无效，未确认副本成功；现有个人数据未切换。',
  shadow_source_changed: '采集期间数据已变化，请停止任务、保存更改后重新创建副本。',
};
export const shadowEn: Record<keyof typeof shadowZh, string> = {
  shadowTitle: 'Local data protection copies',
  shadowRetentionHint:
    'Clearing or restoring current personal data does not delete protection copies. Copies remain on this device; new snapshots rotate the latest two.',
  shadowHint:
    'Save and verify a local copy of saved personal data, retaining the latest two snapshots. Daily reads use existing storage. No automatic migration or restoration occurs; a snapshot may be older than current data.',
  shadowCreate: 'Create and verify copy',
  shadowCheck: 'Recheck saved copies',
  shadowExport: 'Export latest copy for recovery',
  shadow_missing: 'This copy has rotated out. Recheck saved copies and use a current snapshot.',
  shadowDesktop: 'Protection copies require the desktop app. Browser users can export personal data.',
  shadowVerified: 'Saved copies passed integrity verification',
  shadowEmpty: 'No data protection copies yet',
  shadowCreated: 'Latest snapshot time',
  shadowRecords: 'Sessions / CLI records',
  shadowBytes: 'Latest snapshot bytes',
  shadowRetained: 'Copies retained',
  shadow_unavailable:
    'Cannot read or write protection copies. Check free disk space and directory permissions. Existing personal storage is still in use.',
  shadow_corrupt:
    'A protection copy is corrupt or has a mismatched digest. Writing stopped and the file was preserved. Export current personal data before investigating.',
  shadow_version:
    'The protection copy version is incompatible. The file is preserved; check it with a compatible application version.',
  shadow_limit:
    'Protection storage exceeded its limit. Writing stopped. Export personal data and inspect the copy file.',
  shadow_invalid:
    'Invalid protection copy response or digest. Copy success is unconfirmed; existing personal storage is still in use.',
  shadow_source_changed:
    'Data changed during collection. Stop tasks, save changes and create the copy again.',
};
