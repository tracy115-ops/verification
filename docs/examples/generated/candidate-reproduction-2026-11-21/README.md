# 复现资料导出验收产物

- `native-export.png` 来自隔离的 0.20.0 桌面 Release，展示实际导出入口与原始配额失败证据。
- `native-result.json` 记录桌面实际下载后的方法数量、源码摘要及执行关联核对结果。
- `room-replays.json` 和 `quota-replays.json` 记录生产导出资料在两种受控目标上各执行三次的结果。输入是此前真实 CLI 生成的房间容量及配额脚本，重新执行时仅替换测试服务 URL。
- `SHA256SUMS.json` 保存上述验收产物的摘要。

房间容量的重复执行已纳入 `tests/runtime/reproduction.integration.test.ts`，可从仓库根目录运行 `npm run verify:workflow` 复验。[完整验收记录](../../../research/candidate-reproduction-validation-2026-11-21.md)
