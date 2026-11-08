export const shadowZh = {
  shadowSelect: '选择保护副本',
  shadowCopyLabel: '副本 {id}',
  shadowRestorePreview: '预览并恢复所选副本',
  shadowRestoreTitle: '恢复保护副本',
  shadowRestoreScope: '此操作按所选快照完整替换当前个人会话、流程、框架和 CLI 记录。请核对以下恢复范围。',
  shadowRestoreSessions: '个人会话',
  shadowRestoreRuns: '流程运行',
  shadowRestoreRecords: 'CLI 记录',
  shadowRestoreFrameworks: '已保存测试框架',
  shadowRestoreWorkflow: '流程草稿',
  shadowRestoreIncluded: '恢复副本中的草稿',
  shadowRestoreDefault: '未保存草稿，重新使用默认流程',
  shadowRestoreSafety:
    '确认后先将当前数据另存为保护副本，再按已预览内容恢复并重新载入。仍保留最近两份副本；保存当前数据失败时不执行恢复。',
  shadowRestoreConfirm: '确认恢复',
  shadowBeforeRestore: '正在保护当前个人数据…',
  shadowRestoring: '正在恢复并重新载入…',
  shadowRestoreSafetyFailed: '未能保护当前数据，恢复已停止。',
  data_restore_blocked: '任务状态已变化或已离开页面，恢复未执行。请停止任务并保存后重新操作。',
  updatePreparingBackup: '正在创建并校验升级前保护副本…',
  updateFinishingBackup: '安装已取消；正在结束副本写入，不会启动安装器。',
  updateCancelledBeforeInstall: '安装已取消，工作台继续运行。已写入的保护副本可在数据管理中查看。',
  updateHandingOff: '保护副本已就绪，正在交接安装器…',
  updateBackupHint:
    '确认后先保存并校验当前个人数据副本，再启动安装。失败或取消会停止交接。副本保留最近两份，不包含团队项目或磁盘执行证据。',
  updateBackupFailed: '升级前数据准备未完成，未启动安装器。',
  update_backup_required: '缺少升级前保护副本，安装已停止。请重新准备安装。',
  update_backup_stale: '升级前副本已变化或摘要不匹配，安装已停止。请重新准备安装。',
  shadowTitle: '本机数据保护副本',
  shadowRetentionHint:
    '清空或导入当前个人数据不会删除保护副本。副本独立保存在本机，创建新副本时轮换最近两份。',
  shadowHint:
    '保存并校验当前已保存的个人数据，保留最近两份本机副本。日常读取仍使用现有数据；此处不自动迁移或恢复，副本也不代表当前最新状态。',
  shadowCreate: '创建并校验副本',
  shadowCheck: '重新校验已存副本',
  shadowExport: '导出所选副本',
  shadow_missing: '该副本已被轮换，请重新校验并选择当前副本。',
  shadowDesktop: '数据保护副本仅在桌面应用可用；浏览器可导出个人数据。',
  shadowVerified: '已保存副本的完整性校验通过',
  shadowEmpty: '尚无数据保护副本',
  shadowCreated: '所选副本时间',
  shadowRecords: '会话 / CLI 记录',
  shadowBytes: '所选副本字节数',
  shadow_unavailable: '无法读写保护副本。请检查磁盘空间和目录权限；现有个人数据未切换。',
  shadow_corrupt: '保护副本损坏或摘要不匹配，已停止写入并保留文件。请先导出现有个人数据，再排查副本。',
  shadow_version: '保护副本版本不兼容，已保留文件；请使用兼容的应用版本检查。',
  shadow_limit: '保护副本超过存储上限，已停止写入；请先导出个人数据并检查副本文件。',
  shadow_invalid: '保护副本返回的数据或摘要无效，未确认副本成功；现有个人数据未切换。',
  shadow_source_changed: '采集期间数据已变化，请停止任务、保存更改后重新创建副本。',
};
export const shadowEn: Record<keyof typeof shadowZh, string> = {
  shadowSelect: 'Choose a protection copy',
  shadowCopyLabel: 'Copy {id}',
  shadowRestorePreview: 'Preview and restore selected copy',
  shadowRestoreTitle: 'Restore a protection copy',
  shadowRestoreScope:
    'This replaces current personal sessions, workflows, frameworks and CLI records with the selected snapshot. Review the scope below.',
  shadowRestoreSessions: 'Personal sessions',
  shadowRestoreRuns: 'Workflow runs',
  shadowRestoreRecords: 'CLI records',
  shadowRestoreFrameworks: 'Saved test frameworks',
  shadowRestoreWorkflow: 'Workflow draft',
  shadowRestoreIncluded: 'Restore the saved draft',
  shadowRestoreDefault: 'No saved draft; use the default workflow again',
  shadowRestoreSafety:
    'Confirmation first saves a protection copy of current data, then restores the reviewed content and reloads. Only the latest two copies are retained. If saving current data fails, restoration stops.',
  shadowRestoreConfirm: 'Confirm restoration',
  shadowBeforeRestore: 'Protecting current personal data…',
  shadowRestoring: 'Restoring and reloading…',
  shadowRestoreSafetyFailed: 'Current data could not be protected. Restoration stopped.',
  data_restore_blocked:
    'Task state changed or the page was closed. Restoration did not run. Stop tasks, save changes and try again.',
  updatePreparingBackup: 'Creating and verifying a pre-update protection copy…',
  updateFinishingBackup: 'Installation cancelled. Finishing the copy write without starting the installer.',
  updateCancelledBeforeInstall:
    'Installation cancelled; the workbench remains open. Any saved protection copy is available in Data management.',
  updateHandingOff: 'Protection copy ready. Handing off to the installer…',
  updateBackupHint:
    'Confirmation first saves and verifies a personal data copy, then starts installation. Failure or cancellation stops handoff. The latest two copies are retained; team projects and execution evidence on disk are excluded.',
  updateBackupFailed: 'Pre-update data preparation did not complete. The installer was not started.',
  update_backup_required:
    'A pre-update protection copy is required. Installation stopped. Prepare installation again.',
  update_backup_stale:
    'The pre-update copy changed or its digest did not match. Installation stopped. Prepare installation again.',
  shadowTitle: 'Local data protection copies',
  shadowRetentionHint:
    'Clearing or restoring current personal data does not delete protection copies. Copies remain on this device; new snapshots rotate the latest two.',
  shadowHint:
    'Save and verify a local copy of saved personal data, retaining the latest two snapshots. Daily reads use existing storage. No automatic migration or restoration occurs; a snapshot may be older than current data.',
  shadowCreate: 'Create and verify copy',
  shadowCheck: 'Recheck saved copies',
  shadowExport: 'Export selected copy',
  shadow_missing: 'This copy has rotated out. Recheck saved copies and use a current snapshot.',
  shadowDesktop: 'Protection copies require the desktop app. Browser users can export personal data.',
  shadowVerified: 'Saved copies passed integrity verification',
  shadowEmpty: 'No data protection copies yet',
  shadowCreated: 'Selected copy time',
  shadowRecords: 'Sessions / CLI records',
  shadowBytes: 'Selected copy bytes',
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
