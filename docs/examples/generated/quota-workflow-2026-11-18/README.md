# 租户配额预留原生验收产物

这些产物来自同一条桌面任务。真实 Codex CLI 从 Spec 生成需求、场景和 Python，通过四次显式评审后在本机执行。任务在用例节点遇到限流，恢复时保留了已有评审。输入题目、框架及复验步骤见[验收记录](../../../research/quota-workflow-validation-2026-11-18.md)。

- `requirements.json`、`design.json`、`cases.json` 和 `case-methods.json` 记录追溯关系。
- `test_quota.py` 保留原始生成脚本，字节摘要与执行计划一致。
- `report.json` 和 `failed-evidence.json` 记录一次桌面执行的候选缺陷和失败请求。归档的堆栈隐藏了本机文件路径。
- `verdict-locale-replay.json` 是使用原始证据独立复验 0.17.1 中文判定的结果。
- `replays.json` 记录同一脚本在正确参考和四个单缺陷变体上的回放。对照和变体由验收方设置。
- `provenance.json`、`review-decisions.json` 和 `SHA256SUMS.json` 记录运行来源、评审及文件摘要。
- 截图依次展示场景、用例评审及最终报告。原始报告截图保留了验收时遇到的多行断言摘要显示问题。
