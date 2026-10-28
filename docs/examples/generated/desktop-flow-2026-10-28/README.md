# 桌面真实 Agent 闭环产物

来源：2026-10-28 在实际 Tauri 桌面中点击新建、选择已保存流程、输入[游戏平台题目](../../game-platform-blackbox-topic.md)，调用本机 `codex-cli 0.164.0` / `gpt-6.1-terra`。需求、因子、场景、用例和脚本均由真实 CLI 生成，没有注入重放结果；评审澄清、范围排除和执行确认通过界面完成。

| 项目 | 结果 |
| --- | --- |
| 工作流 | 13 / 13 节点完成 |
| 设计 | 10 条需求、10 个因子、17 个场景 |
| 用例 | 草稿 37 条，本次确认执行 36 条，1 条因缺少判定标准排除 |
| Python | 239 行、44 个测试方法；脚本修订保留在本机任务记录 |
| 带缺陷服务 | 33 通过、11 断言失败、0 错误、0 跳过；100 条请求响应 |
| Agent 判定 | 8 组候选问题；后续动作仅报告与人工复现 |
| 修复版对照 | 原脚本不改，44 通过、0 失败、0 错误、0 跳过；101 条请求响应 |

对照验证通过同一原生 Python 执行桥单独运行，不是第二次桌面 Agent 工作流。两次脚本 SHA-256 相同：`2aecbf0039b588b984f9c7ad3352b9ef8a76060c3e84fb12779b9cd66e6a0076`。带缺陷版的失败断言可能提前结束方法，因此请求数不同。

- [manifest.json](manifest.json)：来源、任务 ID、计数、脚本与证据摘要。
- [requirements.json](requirements.json)、[design.json](design.json)：原文引用、因子水平、场景映射与缺口。
- [cases-draft.json](cases-draft.json)、[cases-approved.json](cases-approved.json)：保留完整草稿与本次执行范围。
- [test_generated.py](test_generated.py)：本次实际执行的 Agent 脚本。
- [report.json](report.json)：8 组候选问题、测试映射与 20 条未覆盖 / 排除记录。

这是本地带缺陷样例的可复核结果。报告状态为 `inconclusive`，因为仍有明确保留的覆盖缺口；这不代表工作流发生执行错误，也不能证明真实项目已完整覆盖或根因已确认。原始请求响应与旧脚本保留在本机运行目录，不将机器路径和完整运行数据提交到共享仓库。
