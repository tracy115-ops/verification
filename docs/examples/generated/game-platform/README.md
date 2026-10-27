# 真实 Agent 生成的黑盒验证归档

本目录是生成产物，不是手写的业务实现。输入为[游戏平台题目](../../game-platform-blackbox-topic.md)及仓库测试夹具中的 `framework.py`；通过本机 Codex CLI、模型 `gpt-6.1-terra` 生成。未向模型提供被测目标源码，归档脚本未手改。

- [Python 测试脚本](test_game_platform.py)：36 个测试方法，使用提供的 `BlackBoxCase` 框架。
- [验证结果与覆盖映射](report.json)：15 处失败断言，按模型给出的需求 / 方法分为 8 组候选问题；参考实现 36 项全部通过。
- [缺陷样例请求响应](buggy-evidence.jsonl)、[参考实现请求响应](reference-evidence.jsonl)：仅包含合成测试数据，没有真实账号凭据。

脚本 SHA-256 记录在 report.json。绝对机器路径已在结果中替换为 `<generated>`；HTTP 请求由本机受控服务处理。测试方法分组不等于缺陷根因数量，也不构成需求完备性证明。

不再调用模型的复现命令：`npm run verify:game-agent -- --reuse-script`。没有本地运行产物时，命令从本目录恢复脚本并检查摘要。重新生成需要先构建 Rust turn 示例，再显式传 `--model`；这会产生真实推理调用。
