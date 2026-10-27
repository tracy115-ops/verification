# 验证 Agent 设计档案

更新：2026-10-27。状态：**提案 / 待工程验证**。用户明确的项目约束已经生效；产品范围、技术栈及数据结构是本轮建议，尚未实现或完成兼容性认证。

## 文档导航

| 文档 | 解决的问题 |
| --- | --- |
| [企业工程约束](governance/engineering-constraints.md) | 国际化、代码规模、扩展性、测试与配置边界 |
| [产品定位与头脑风暴](product/vision-and-brainstorm.md) | 谁使用、完整旅程、差异点、优先级与待定项 |
| [系统架构与选型](architecture/system-design.md) | 为什么选择本地工作台、如何分层、模块边界 |
| [CLI 与 Provider](architecture/cli-and-provider-design.md) | 使用已安装 Agent、快速配置和兼容性探测 |
| [工作流引擎](architecture/workflow-engine.md) | 自定义生成、保存、审核、版本化与恢复 |
| [需求追溯与点灯](architecture/domain-and-traceability.md) | 原文定位、场景树、完整性评估、变更失效 |
| [执行、判定与后续动作](architecture/execution-and-verdict.md) | 本地 / SSH / WSL、证据、判定优先级及闭环 |
| [默认通用测试工作流](workflows/general-testing.md) | 每阶段的输入、输出、评审与异常分支 |
| [实施与验证计划](roadmap/implementation-plan.md) | 分期范围、验收样例、工程风险验证 |
| [本机能力与官方资料](research/cli-capability-baseline.md) | 已核实事实与仍需实测的假设 |
| [本轮归档验证记录](research/design-validation.md) | Schema、图、链接及检查范围的实际结果 |
| [ADR-0001](adr/0001-local-first-modular-monolith.md) | 首个架构决策及替代方案 |
| [工作流 JSON 示例](examples/general-testing.workflow.json) | 声明式定义的评审样本，不是已支持的运行格式 |
| [可编辑架构图](diagrams/verification-platform.drawio) | 模块关系；用 draw.io 打开 |

## 推荐阅读顺序

先看产品定位，再看默认工作流及追溯模型，最后评审选型与实施计划。先判断是否能可靠回答“需求漏了什么、实际测了什么、依据是什么、接下来做什么”，再扩展工作流画布与更多 Agent。

## 设计原则

1. 工作流由系统编排；Agent 负责受约束的生成、分析与建议。
2. Agent 角色、CLI 实现、模型 Provider、测试执行环境分别配置。
3. 原始需求、审批记录和执行证据不可被生成结论替代。
4. 保存定义不等于执行；历史运行固定定义和输入版本。
5. 先本地单用户跑通，团队权限与集中调度在后续阶段建设。

## 本轮归档范围

项目规范、方案、示例和 Git 基线。架构图提供原始 XML；本机未在 PATH 或常见安装路径发现 draw.io CLI，因此本轮未导出或进行 PNG 视觉检查。文中 Mermaid 图可由支持 Mermaid 的 Markdown 阅读器展示。
