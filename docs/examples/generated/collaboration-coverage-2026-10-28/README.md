# 实际 Agent 协作补漏与覆盖验收

输入为房间创建黑盒题，仅提供 JSON 外部接口及容量、模式、排位组合约束。先通过协作网页创建项目并生成 6 个明确标注为规则建议的候选场景，再从实际桌面会话驱动本机 Codex 补漏。

实际模型：`gpt-6.1-terra`。调用 ID：`baee1479-07a7-4db2-968d-183e799a04fe`。原始提交与公开回复保存在 `cli-turn.json`，未用预填的 Agent 回复代替推理。

Codex 生成 3 条增量建议：因子、场景及用例各一条，针对排位对决使用三人容量应返回 400；同时交付 `script.py`。通过网页导入建议、逐条合入、评审场景与用例、保存手工覆盖声明，再导入实际生成的脚本及映射。原先的 6 个场景保留。

`project.json` 是合入后的服务端快照，保留成员、来源、原建议、合入决策、用例评审、覆盖声明、脚本原文及 SHA-256。`result.json` 记录此次验收边界。管理员访问令牌没有归档。

脚本经过真实 Python AST 解析，方法 `test_ranked_duel_three_players_returns_400` 与共享用例 `QA_TC` 对应。此轮**没有执行这份测试脚本**，页面显示“方法映射已核对”及“未执行／无结果”，不宣称捕获缺陷或通过测试。

相关截图：[补充评审](../../../images/shared-contribution-review.png)、[共享用例](../../../images/shared-case-coverage.png)、[覆盖声明与方法映射](../../../images/shared-case-script-mapping.png)。此前完整桌面运行的个人用例也已核对自动映射和实际执行状态，见[个人用例截图](../../../images/personal-case-script-coverage.png)，其执行档案仍在[原完整流程目录](../desktop-flow-2026-10-28/README.md)。
