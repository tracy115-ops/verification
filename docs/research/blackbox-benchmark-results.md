# 本地黑盒缺陷发现基准

时间：2026-10-27T12:19:52.888Z。本报告是实际 HTTP 请求结果，目标为受控种子缺陷样例，不是用户真实系统，也不是 Agent 自主生成测试的认证。

- 正常路径：5 项，发现 0 类候选缺陷。
- 增强计划：26 项，11 项失败，合并为 9 类候选缺陷；0 项无法判定。
- 修正参考实现：26 项，0 项失败，0 项无法判定。
- 基准验收：通过。详细请求、响应、断言差异见运行后生成的 `.runtime/blackbox/report.json`。

| 用例 | 问题 | 规则 | 方法 |
| --- | --- | --- | --- |
| B1 | 金额边界 0 | QUOTE | boundary |
| T0 | 金额类型 "5" | QUOTE | type |
| T1 | 金额类型 null | QUOTE | type |
| A02 | 跨用户访问 | ACCESS | authorization |
| I01 | 同一幂等键重放 | TRANSFER | idempotency |
| C01 | 并发扣款不透支 | WITHDRAW | concurrency |
| S01 | 已完成订单拒绝取消 | ORDER | state_transition |
| D1 | 折扣决策 age=17 member=true | DISCOUNT | decision_table |
| D2 | 折扣决策 age=18 member=false | DISCOUNT | decision_table |
| E01 | 纯空白用户名 | NAME | equivalence |
| X01 | 外部支付拒绝 | PAYMENT | dependency |

复现命令：在仓库根目录执行 npm run verify:blackbox。每次启动全新本地目标，执行器仅使用公开题目与 HTTP 接口。
