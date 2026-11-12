export const conversationStorageZh = {
  storeTitle: '会话事务存储',
  storeScope:
    '迁移会话、对话输入和运行产物。流程库、全局配置及 CLI 日志暂时保留原存储路径；这不是全部个人数据迁移。',
  storeBrowser: '当前使用浏览器存储',
  storeSaved: '会话已写入 SQLite',
  storeSaving: '正在保存会话，请等待写入完成',
  storeFailure:
    '会话尚未保存到数据库，当前内容保留在内存中。请重试，或先导出恢复副本；关闭或强杀可能丢失未提交内容。',
  storeInspect: '检查并迁移会话',
  storePreview: '确认会话存储来源',
  storeNew: '未发现已初始化的会话库。将先创建当前个人数据的保护副本，再把浏览器会话迁入 SQLite，并重新载入。',
  storeExisting: '发现已有 SQLite 会话库。启用后读取该库，不合并或覆盖它；当前浏览器数据会先保存保护副本。',
  storeSourceCount: '浏览器会话数',
  storeTargetCount: '数据库会话数',
  storeRevision: '已提交版本',
  storeActivate: '保护数据并启用',
  storeRetry: '重试保存',
  storeExport: '导出当前会话恢复副本',
  storeBoot: '正在读取会话数据库…',
  storeBootFailed: '无法读取会话数据库。数据库未被清空，也没有自动回退到旧数据。',
  storeReadRetry: '重新读取',
  storeFallback: '打开旧浏览器副本',
  storeFallbackHint:
    '旧浏览器副本可能停留在迁移时刻，缺少之后的修改。此操作仅切换读取来源，不覆盖 SQLite；之后可在数据管理中重新连接已有数据库。',
  store_conflict:
    '会话数据库已被其他实例修改。不会覆盖其数据；请先导出当前恢复副本，再重新打开应用读取最新版本。',
  store_corrupt: '会话数据库或摘要校验失败，原文件已保留。请使用保护副本恢复，避免删除原文件。',
  store_version: '会话数据库版本不兼容，请使用匹配版本的应用。',
  store_limit: '会话存储达到容量限制，请先导出数据并整理历史任务。',
  store_invalid: '会话数据校验失败，未覆盖已提交记录。',
  store_unavailable: '会话数据库暂不可用，请检查磁盘空间、访问权限或其他占用后重试。',
  store_missing: '未找到已启用的会话数据库。请恢复原数据库或显式打开旧浏览器副本。',
  store_source_changed: '迁移期间浏览器会话发生变化，已停止切换。请重新检查后再迁移。',
};
export const conversationStorageEn: Record<keyof typeof conversationStorageZh, string> = {
  storeTitle: 'Transactional conversation storage',
  storeScope:
    'Moves conversations, composer input and run artifacts. Workflows, global settings and CLI logs retain their current storage. This is not a migration of all personal data.',
  storeBrowser: 'Using browser storage',
  storeSaved: 'Conversations committed to SQLite',
  storeSaving: 'Saving conversations. Wait for the commit.',
  storeFailure:
    'Conversations have not been committed. Current content remains in memory. Retry or export a recovery copy; closing or killing the app may lose uncommitted content.',
  storeInspect: 'Inspect and migrate conversations',
  storePreview: 'Confirm conversation data source',
  storeNew:
    'No initialized conversation database was found. Create a protective copy of current personal data, migrate browser conversations to SQLite and reload.',
  storeExisting:
    'An existing SQLite database was found. Enabling reads that database without merging or overwriting it. Current browser data is protected first.',
  storeSourceCount: 'Browser conversations',
  storeTargetCount: 'Database conversations',
  storeRevision: 'Committed revision',
  storeActivate: 'Protect data and enable',
  storeRetry: 'Retry saving',
  storeExport: 'Export current conversation recovery copy',
  storeBoot: 'Reading conversation database…',
  storeBootFailed:
    'Cannot read the conversation database. It has not been cleared or silently replaced with older data.',
  storeReadRetry: 'Read again',
  storeFallback: 'Open old browser copy',
  storeFallbackHint:
    'The browser copy may date from migration and omit later changes. This switches the read source without overwriting SQLite. Reconnect to the existing database in Data management later.',
  store_conflict:
    'Another instance changed the database. Its data will not be overwritten. Export a recovery copy before reopening the app to read the latest revision.',
  store_corrupt:
    'Database or checksum verification failed. The original file is retained. Recover from a protective copy without deleting the original.',
  store_version: 'The database version is incompatible. Use a matching application version.',
  store_limit: 'Conversation storage reached its capacity. Export data before organizing historical tasks.',
  store_invalid: 'Conversation data validation failed. Committed records were not overwritten.',
  store_unavailable: 'Database unavailable. Check disk space, permissions or competing access, then retry.',
  store_missing:
    'The enabled conversation database was not found. Restore it or explicitly open the old browser copy.',
  store_source_changed:
    'Browser conversations changed during migration. Switching stopped. Inspect again before migrating.',
};
