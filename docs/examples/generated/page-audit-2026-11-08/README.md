# 0.10.3 页面验收证据

- [实际桌面会话](desktop-session.png)：Release WebView、原始 IPC，通过界面导入历史真实任务及四条 CLI 档案，展示公开回复、产物和阶段状态；本轮没有重新调用模型。
- [实际桌面资产](desktop-assets.png)：同一任务进入因子页，离页后返回仍保留 `F1` 检索和当前页签。
- [紧凑 Agent 设置](compact-agent-settings.png)：生产浏览器构建，900×650，四个探测卡片收紧；浏览器提示明确说明原生 CLI 只能在桌面调用。
- [原生检查摘要](native-summary.json)：六个主页面、七个设置分区、三项跨页状态和未捕获异常记录。不包含机器路径、凭据或内部题目。

完整检查范围及未覆盖边界见[验收记录](../../../research/page-continuity-audit-2026-11-08.md)。其他 120 个页面状态及专项对话框截图由 Playwright 输出到 `.runtime/product-audit`；GitHub 打包流程会上传本轮对应的界面审查产物。
