# 场景旅程 0.22.0 验收资料

- `result.json`、`editor.png`、`restored.png`：隔离的原生 Windows Release 桌面，真实操作编辑控件，校验断链拦截、修订、历史及刷新。输入是手写契约夹具；不代表模型生成或测试执行。
- 英文深色截图：生产构建的 900 宽度 UI 检查，同样使用手写夹具。
- `large-analysis-failure.json`：完整公开订单题目的真实 Claude 调用失败摘要。零公开正文、原始协议输出达到上限，未完成有效设计；不是成功样例。
- `focused-topic.md`：验收方明确限定的一条拒绝后恢复旅程；仅提供题目和框架，无目标源码。
- `model-output.json`、`test_generated.py`：新一次真实 Claude / glm-5.3-flash 调用经生产引擎生成的需求、5 步场景、用例和原脚本，含源码/框架/题目 SHA-256。
- `focused-execution.json`：限定题目完成 13 节点生产引擎流程，fixture 审批由验收程序确认；原脚本在正确目标通过。
- `target-comparison.json`：同一新脚本在正确目标和 `declined_payment_commit` 目标的真实原生执行对照。正确目标零失败，缺陷目标一项断言失败，均无执行错误。
- `generated-journey.png`、`generated-report.png`、`generated-ui-result.json`：最终原生 Release 恢复并查看上述真实生成结果和通过报告；本次查看不重新调用模型。

本机完整调用记录位于 `.runtime/journey-live-2026-11-22/`，原生界面记录位于 `.runtime/journey-native-022/`。共享档案只保存安全的诊断计数和截图，不包含 CLI 来源路径、配置内容或凭据。

测试入口为 `scenario-journey.test.ts` 与 `tests/e2e/scenario-journey.spec.ts`。[验收记录及后续边界](../../../research/scenario-journey-validation-2026-11-22.md)。

`tests/runtime/scenario-journey.integration.test.ts` 对归档脚本持续执行对照。框架源码来自仓库 `tests/fixtures/blackbox/framework.py`，仅将默认 fixture 身份改为题目声明的 user-a。预检校验归档 SHA-256 后执行，不对脚本做人工业务修补。文档字符串曾触发旧预检限制，修复运行时后使用原脚本继续执行。
