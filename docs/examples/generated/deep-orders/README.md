# 真实 Agent 生成的深层状态旅程测试

2026-11-03，使用本机 Codex CLI，请求模型标识 `gpt-6.1-sol`，一次真实调用约 129 秒。输入仅为[题目](../../order-journeys-blackbox-topic.md)、所提供框架、输出 Schema 与共用 `deepTestingGuidance`；没有给模型目标源码、变体标识或缺陷清单。

## 实际产物

- `prompt.json` / `reply.txt`：实际输入和公开回复。
- `agent-artifact.json` / `test_orders.py`：未手工改写的脚本、需求映射与 questions；15 个独立测试方法。
- `framework.py`：实际提供的框架，复用仓库框架并将默认夹具身份设为 user-a。
- `generation.json`：请求标识、实际耗时、安全原生诊断及脚本、输入、框架、题目的摘要。`artifactSha256` 绑定脚本和映射。
- `report.json`：正常路径、正确参考、六个独立变体及失败方法的完整请求/响应复现序列。
- `*.evidence.jsonl`：原生执行器返回的结构化请求证据。
- `replays.json`：额外两轮原脚本重放的结果摘要；最终归档前又运行一轮，结果一致。
- `SHA256.json`：生成数据文件的校验值，不包含本 README 和校验文件自身。

## 实际结果

| 独立种子变体 | 被捕获行为 | 失败方法 / 执行错误 |
| --- | --- | --- |
| cancel_replay_stock | 重复取消重复归还库存 | 1 / 0 |
| declined_payment_commit | 支付拒绝状态正确，但订单/钱包已提交 | 1 / 0 |
| payment_replay_debit | 支付重放重复扣款 | 2 / 0 |
| idempotency_identity_scope | 跨身份幂等键错误共享 | 1 / 0 |
| rejected_cancel_mutation | paid 取消返回 409，却改变终态和库存 | 1 / 0 |
| concurrent_payment_debit | 两个成功支付响应对应重复扣款 | 1 / 0 |

七个目标的普通正常路径均通过。正确参考目标 15 / 15 通过；相同脚本在六个独立变体上均产生断言失败，无执行错误或跳过。全部变体的预检脚本 SHA-256 一致：`187eecddc441692245b39d72b2ed35ad44a1a4944bd61205cfb0a0bde273446f`。

最初用受控 Python 运行器探索，随后通过产品相同的 execution-runtime 原生预检与执行再验证，并重复重放。原生执行使用新计划摘要；基准生成的 BENCH-* 标识仅标记方法，不冒充用户批准的用例或完整 13 节点验收。

## 复现

使用 Node 24、Python 3.11+，在仓库根目录执行：

```powershell
npm ci
cargo build -p execution-runtime --example local --locked
npm run verify:deep-agent -- --reuse-script
```

重放从归档导入固定脚本，不调用模型。重新生成需要先构建 agent-runtime 的 turn 示例，再显式执行 `npm run verify:deep-agent -- --driver codex --model <本机模型ID>`；会产生一次真实模型调用，没有自动付费重试。题目、框架、脚本或映射发生变化时，不沿用旧摘要。

## 边界

变体名是维护者已知的种子标签，不是 Agent 诊断出的根因。没有自动状态空间搜索或最小化；复现记录是失败方法的完整请求序列。原生 `rawEvidenceSha256` 指向执行器原始证据，归档 JSONL 是其结构化导出，使用 SHA256.json 独立核验。路径已脱敏，私有推理正文和原生会话 ID 未归档。受控样例的六变体命中率不能代表用户项目发现率或完整覆盖；内部 CodeAgent 和桌面点击链路仍未认证。
