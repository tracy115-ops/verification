# 黑盒账户与订单接口题（本地基准）

仅提供本题、外部 HTTP 接口和测试账号，不需要读取实现源码。所有数据为本地夹具，不能用于真实金融系统。每次基准启动获得全新状态。

| 接口 | 契约与可观察预期 |
| --- | --- |
| `POST /quote`，JSON `{amount}` | amount 必须为 JSON number 类型的整数，范围 1–100（含端点）；有效返回 200，非法返回 400 |
| `GET /accounts/:id` | `Authorization: Bearer user-a` 仅可访问本人 `user-a`、测试专用 `idempotency` / `concurrent` 账户；访问 `user-b` 返回 403；无凭据返回 401 |
| `POST /transfer`，JSON `{amount:10}` | 通过 `Idempotency-Key` 去重；同一个 key 重放不得重复扣款。专用账户 idempotency 初始余额 100 |
| `POST /withdraw`，JSON `{amount:80}` | 并发扣款不允许透支。专用账户 concurrent 初始余额 100；两次并发请求必须一次 200、一次 409，最终余额 20 |
| `POST /orders/completed/cancel` | 已完成订单不能取消，返回 409 且状态仍为 completed |
| `POST /discount`，JSON `{age,member}` | 年龄至少 18 且为会员才享 10 折扣；其他组合为 0；返回 200 |
| `POST /users`，JSON `{name}` | 用户名去除首尾空白后必须非空；有效返回 201，空字符串／纯空白返回 400 |
| `POST /payments`，JSON `{paymentToken}` | 普通测试 token 返回 200 / paid；declined-fixture 表示外部支付拒绝，必须返回 402 / declined |

测试设计需包含有效与无效等价类、边界、类型、身份权限、重复请求、并发、状态转换、决策表及依赖拒绝。HTTP 或 JSON 读取失败记为无法判定，不能直接当作产品缺陷。

初始只跑正常路径，再跑增强计划，对比新增发现。报告按违反的规则与类别合并候选缺陷，保留各次请求、响应、判定和复现步骤。实现夹具中的种子缺陷清单只用于基准验收，不作为测试执行器输入。
