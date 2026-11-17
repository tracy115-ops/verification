# 框架检查原生验收资产

由 `tests/live/desktop-framework-inspection.spec.ts` 驱动本地 0.16.0 Release 窗口生成，原 Tauri IPC 未替换，使用真实 Python 3.11.15。输入为测试内可审查的合成框架，未使用模型输出、用户 Spec、认证或私有 SDK。

- `summary.json`：原生检查范围及未处理错误。
- `declarations-native.png`：框架包含顶层 `raise` 但仅被解析，展示入口和 setUp 声明。
- `syntax-native.png`：语法错误及源码行定位入口。
- `issues-900-dark.png`：窄窗口深色主题的明确问题。
- `SHA256SUMS.json`：上述文件的 SHA-256。

使用独立审计应用标识和 WebView2 目录；结束后已恢复正常 Release 标识。报告只证明静态检查与界面链路，不证明框架运行、模型生成或用户目标测试成功。详见[验收记录](../../../research/framework-inspection-validation-2026-11-17.md)。
