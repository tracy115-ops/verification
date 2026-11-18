# 租户配额预留端到端验收

2026-11-17 至 18，Windows Release WebView2。使用独立应用标识及数据目录，真实 Tauri IPC、本地 Python 和 Codex CLI 0.169.0（请求模型为 gpt-6-sol）。题目及对照服务由本次验收创建。Agent 的运行请求包含 Spec、框架和相应阶段的产物。对照服务实现和预设缺陷清单仅由验收方持有。

## 真实流程暴露的问题

| 阶段 | 已观察到的行为 | 处理 |
| --- | --- | --- |
| 原文定位 | 两条权限需求引用了同一句原文，无法区分释放和消费 | 在界面补上 R4、R5 原文上下文，无需再次解析需求 |
| 因子设计 | 因子 `F_LIFECYCLE` 引用了超出关联需求摘录范围的段落，旧版只显示通用错误 | 新增具体诊断，用同一份任务在 0.17.0 重试并通过覆盖评审 |
| 状态展示 | 输入发送后被清空，准备提示仍显示配置缺失。单次分析同时显示假设的分批计划 | 更新空草稿提示和单次分析状态 |
| 用例生成 | 首次调用遇到模型服务限流，任务停在用例节点 | 保留已通过的两次评审，重新打开桌面后只重试用例节点 |

真实生成的设计包括 23 条需求、9 个因子、13 个场景。场景关联了全部已提取需求和已声明的因子水平。评审重点核对重放后配额、被拒绝操作的前后状态、租户独立性及并发配额守恒。覆盖数字限于本次设计基线。

## 复验入口

使用隔离标识 `dev.verification.workbench.auditquotaflow` 编译 Release。以 `node scripts/serve-quota-fixture.mjs --defect release_replay` 启动本机目标。用 `scripts/start-desktop-audit.mjs` 启动应用后，将返回的 loopback 地址传给 `scripts/audit-quota-workflow.mjs --endpoint`。通过 `configure`、`start`、`status`、`review` 查看原生流程。确认节点时通过 `approve` 指定操作和已核对的评审理由。生成结果位于 `.runtime/quota-flow`。

默认流程仍要求单文件 unittest、Python 预检和执行计划确认。内部 CodeAgent、多文件 SDK 及独立外部题目仍需专项验收。
