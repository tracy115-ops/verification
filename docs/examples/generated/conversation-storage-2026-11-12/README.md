# 会话事务存储验证产物

来自 `tests/live/desktop-conversation-storage.spec.ts` 与 `tests/e2e/conversation-storage-layout.spec.ts`。

- 原生截图与摘要：隔离应用标识、原始 IPC、通过界面保护迁移并提交，再终止和重新启动实际进程，检查从 SQLite 读取及旧产物顺序/审批保留。
- 英文深色截图：离线桥接协议夹具的界面布局检查，不证明原生持久化。

原生输入来自 `../cli-transcript-2026-10-28/run.json` 历史运行和明确的测试会话文本；本轮无新模型调用、无新业务测试执行。未归档数据库、用户配置或认证文件。物理断电、磁盘满和全部个人数据迁移不在本次实测范围。
