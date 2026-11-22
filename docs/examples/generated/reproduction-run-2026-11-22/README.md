# 0.21.0 原生复跑证据

`result.json` 与三张中文截图来自隔离 Windows Release 桌面端的真实操作：

`evidence-summary.json` 从实际运行导出每次执行的源码/计划摘要、方法结果及停止记录，省略本机路径和原文内容。

- `repeated-failure.png`：同一候选关联方法已在两次原生执行中失败。
- `after-retry.png`：停止第三次执行后，重新预检和确认，正确目标执行通过。
- `reopened.png`：刷新后从运行实例恢复观察结果。
- `reproduction-en-US-dark-900.png`：生产构建的英文、深色、900 宽度 UI 契约检查，使用离线 IPC；不作为真实执行证据。

输入为历史真实 CLI 生成并已评审的房间容量设计与四方法脚本，本轮沿用其原文；实际基线及复跑使用真实 Rust/Python 执行器和本地 HTTP 对照目标，无新模型推理。完整原生运行留在本机 `.runtime/replay-ui-native/runs.json`，包含本机路径而不纳入共享档案。结构化摘要保留执行 UUID，未携带 CLI 配置或凭据。

源码及框架由生产预检计算 SHA-256，匹配后才执行；本目录 `SHA256SUMS` 用于校验归档文件。复验入口为 `tests/runtime/reproduction-run.integration.test.ts` 和 `tests/e2e/reproduction-run.spec.ts`。[验收步骤和边界](../../../research/reproduction-run-validation-2026-11-22.md)。
