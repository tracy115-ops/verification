# 验证 Agent 设计档案

更新：2026-10-28。状态：**本地黑盒验证闭环与局域网协作开发版**。正式编排可选择设计评审，或运行完整 13 节点：题目 → 场景 / 用例 → Python → 人工执行确认 → 本地执行 → 证据分析与报告。当前执行适配单文件 Python unittest；会话保留实际 CLI 任务与公开回复，桌面设置可托管共享服务，同事从协作页发现并在浏览器加入。任意框架、内部 CodeAgent 目标环境及远程执行仍待接入或验证。

## 文档导航

| 文档 | 解决的问题 |
| --- | --- |
| [需求引用校验与恢复](design/requirement-quote-recovery.md) | 格式匹配、问题引用定位、旧任务草稿恢复及修复审计 |
| [对话上下文预算](design/conversation-context-budget.md) | 历史窗口、仅本条消息、完整输入与流程 Spec 去重 |
| [受监督更新交接](design/supervised-desktop-update.md) | 独立更新进程、等待退出、安装退出码和重启记录 |
| [在线升级栈溢出复现](research/update-stack-overflow-reproduction.md) | 真实桌面崩溃证据、IPC 任务大小回归及首次迁移 |
| [0.4.2 更新验收](research/release-0.4.2-update-validation.md) | 远端完整更新进程检查、下载校验及目标环境边界 |
| [非 CodeAgent 环境验收](research/post-codeagent-independent-acceptance.md) | 黑盒执行、失败恢复、原生 PAC 与安装流水线检查及待验收边界 |
| [企业工程约束](governance/engineering-constraints.md) | 国际化、代码规模、扩展性、测试与配置边界 |
| [桌面客户端协作](design/desktop-collaboration.md) | 软件内发现、登录和加入项目，网络边界与协作视图 |
| [桌面协作验证](research/desktop-collaboration-validation.md) | 两份真实软件的登录、分工评审同步及分步界面证据 |
| [运行实例用途与交互](design/run-records.md) | 跨会话排查、历史产物、报告与耗时记录边界 |
| [GitHub 手动打包](workflows/github-packaging.md) | Actions 手动触发 Windows 安装包、下载与本地复现 |
| [版本与发布规则](workflows/versioning.md) | 应用版本同步、标签校验、正式 Release 与构建追溯 |
| [0.1.2 发布验证](research/release-0.1.2-validation.md) | 远端构建、目录冲突回归、回复动效和下载校验结果 |
| [0.1.4 CLI 探测验证](research/release-0.1.4-validation.md) | Windows bat 入口、可复用配置状态同步与正式包校验 |
| [人工与 Agent 补充设计](design/human-and-agent-design-editing.md) | 个人因子与场景编辑、修订评审、局域网增量提交接口 |
| [界面与交互设计](design/interface-design.md) | 会话首页、设置、编排与评审工作区 |
| [会话调用与设置方案](design/conversation-and-settings.md) | 保存流程如何从会话调用、真实 CLI 边界与恢复规则 |
| [黑盒与团队协作](design/blackbox-and-team-testing.md) | 题目 / 框架输入、Python 输出、共享因子场景与局域网部署 |
| [面向任务的黑盒测试设计](design/task-analysis-workflow.md) | 从题目到需求、因子、场景、用例、执行和问题的逐条追溯设计 |
| [黑盒与协作验证](research/blackbox-and-team-validation.md) | 真实 CLI 生成 36 项 Python 测试、缺陷证据和多人回归 |
| [本地 Python 工作流使用与契约](workflows/local-python-verification.md) | 框架设置、四次确认、方法映射、证据格式及恢复边界 |
| [完整工作流验证记录](research/python-workflow-validation.md) | 正式状态机、真实 Python、12 个失败方法 / 8 组候选与修复版对照 |
| [界面与真实流程验收](research/interface-workflow-audit.md) | 各页面检查、真实需求分析结果与阻塞问题 |
| [内部 CodeAgent 驱动](architecture/codeagent-driver.md) | 内置模型、扫描路径、参数探测与实际验证边界 |
| [CodeAgent 初始化后超时](research/codeagent-initialization-timeout.md) | 初始化无正文的诊断边界、事件追踪和独立原生驱动对比 |
| [ADR-0002](adr/0002-lan-design-collaboration-service.md) | HTTP 协作服务与 SQLite 的职责和取舍 |
| [ADR-0003](adr/0003-incremental-contributions-and-coverage.md) | 增量合入、版本绑定覆盖及静态解析的信任边界 |
| [首轮开发计划](roadmap/development-plan.md) | 已实现的第一轮范围及后续开发边界 |
| [产品定位与头脑风暴](product/vision-and-brainstorm.md) | 谁使用、完整旅程、差异点、优先级与待定项 |
| [系统架构与选型](architecture/system-design.md) | 为什么选择本地工作台、如何分层、模块边界 |
| [CLI 与 Provider](architecture/cli-and-provider-design.md) | 使用已安装 Agent、快速配置和兼容性探测 |
| [桌面真实流程验收](research/desktop-flow-acceptance.md) | 系统代理修复、真实 CLI / Python 闭环与会话管理验证 |
| [局域网发现与桌面托管](design/lan-discovery-and-hosting.md) | 设置、扫描、浏览器加入、共享范围及资源构建 |
| [增量协作与脚本覆盖](design/collaborative-contributions-and-script-coverage.md) | 逐条合入、共享用例、覆盖声明、AST 映射与失效规则 |
| [协作与覆盖验收](research/collaboration-coverage-validation.md) | 真实 CLI 补漏、逐条合入、方法映射及多人验证 |
| [会话资产归属验收](research/conversation-assets-validation.md) | 当前会话绑定、去除任务下拉、紧凑布局与会话搜索 |
| [CLI 操作与工作流接入分析](architecture/cli-workflow-operation-analysis.md) | 设置、会话、各 CLI 已验证边界及 CodeAgent 目标环境验收 |
| [工作流引擎](architecture/workflow-engine.md) | 自定义生成、保存、审核、版本化与恢复 |
| [需求追溯与点灯](architecture/domain-and-traceability.md) | 原文定位、场景树、完整性评估、变更失效 |
| [执行、判定与后续动作](architecture/execution-and-verdict.md) | 本地 / SSH / WSL、证据、判定优先级及闭环 |
| [默认通用测试工作流](workflows/general-testing.md) | 每阶段的输入、输出、评审与异常分支 |
| [实施与验证计划](roadmap/implementation-plan.md) | 分期范围、验收样例、工程风险验证 |
| [本机能力与官方资料](research/cli-capability-baseline.md) | 已核实事实与仍需实测的假设 |
| [本轮归档验证记录](research/design-validation.md) | Schema、图、链接及检查范围的实际结果 |
| [首轮开发验证记录](research/first-development-validation.md) | 实际构建、测试、CLI 探针结果与未完成边界 |
| [会话开发验证记录](research/conversation-development-validation.md) | 本轮状态机、CLI 协议、进程取消和界面验证 |
| [ADR-0001](adr/0001-local-first-modular-monolith.md) | 首个架构决策及替代方案 |
| [工作流 JSON 示例](examples/general-testing.workflow.json) | 当前 13 节点模板；设置 Profile 后保存，再从会话调用 |
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

已归档规范、方案、示例、首轮代码、开发计划和验证记录。架构图提供原始 XML，本轮未导出架构图 PNG；界面截图来自实际浏览器。文中 Mermaid 图可由支持 Mermaid 的 Markdown 阅读器展示。
