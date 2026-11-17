# 0.16.1 长源码跳行验收

由 `tests/live/desktop-framework-inspection.spec.ts` 驱动真实 Release WebView2 窗口及原始 IPC 生成。先核对独立审计应用标识与 0.16.1 版本，再导入测试中的合成框架。没有使用用户题目、模型回复或私有 SDK。

框架前插入 120 行上下文，报告点击第 123 行后，断言入口声明已选中、该行位于源码编辑器实际可视范围内。`distant-line-native.png` 显示真实选区；`summary.json` 包含版本、隔离标识及无未处理错误结论，文件摘要见 `SHA256SUMS.json`。

完整语法、动态入口及重载检查同时保留。此记录不证明框架执行或模型生成成功。详见[专项验收](../../../research/framework-inspection-validation-2026-11-17.md)。
