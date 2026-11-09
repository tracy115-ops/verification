# 流程库与缺口检查操作截图

2026-11-09，0.12.0，Windows。

- [原生桌面浅色中文](native-library-light-zh.png)、[原生桌面深色英文](native-library-dark-en.png)：`tests/live/desktop-library.spec.ts` 在独立 Release WebView 通过真实界面操作生成，无 IPC 替身。
- [原生摘要](native-summary.json)：保存两个流程、刷新后会话选择保留、页面与设置导航。`freshModelCall: false`，本轮未调用真实模型。
- [窄窗英文深色流程库](library-narrow-dark-en.png)：生产页面，直接重命名及控件可达性验证。
- [设计缺口界面](design-gap-ui-fixture.png)：历史运行结构加显式构造的因子/场景映射样本，用于验证缺口展示与跳转，不是 Agent 新生成设计，也不是实际缺陷发现证据。

截图由 Playwright 操作生成；完整命令与范围见[验证记录](../../../research/workflow-library-validation-2026-11-09.md)。
