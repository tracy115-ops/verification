# 订单与库存：状态旅程黑盒验证题

仅提供本文和框架，没有系统源码。JSON 接口由框架 `user` 参数指定身份；`user-a`、`user-b` 是夹具身份，不是凭据。每个测试方法开始时，框架恢复独立初始状态：库存 available=4；两个身份各有 balance=100、charges=0；没有订单或幂等记录。单价为 10，不涉及真实资金或外部生产服务。

## R1 预留与身份隔离

`POST /orders` 输入 `{quantity, requestId}`。quantity 为 1–4 的整数，requestId 为非空字符串。首次成功返回 201，JSON 为 `{id,owner,quantity,state:"reserved"}`；id 是运行时生成的不透明值。库存减少 quantity。库存不足返回 409，不改变任何状态；非法参数返回 400，不改变任何状态。

幂等键是 `(身份,requestId)`：同一身份以相同键和相同 quantity 重放返回 200 和原订单，不再次占用库存；改变 quantity 返回 409，订单和库存不变。不同身份使用相同 requestId 是两个独立创建请求，各返回 201 和各自订单，只受剩余库存限制。

## R2 查询与观测

`GET /inventory` 返回 200 / `{available}`，两个身份均可读取；`GET /wallet` 返回调用身份的 200 / `{balance,charges}`。`GET /orders/{id}` 返回所属身份的订单 `{id,owner,quantity,state}`；另一身份查询该已知订单返回 403，不改变状态。本文接口缺少有效身份时返回 401。

## R3 取消与终态

`POST /orders/{id}/cancel` 输入 `{}`。reserved → cancelled，返回 200，只释放一次 quantity 库存，不改变余额或 charges。cancelled 状态重复取消仍返回 200，不再次释放库存。paid 订单取消返回 409，订单、库存和钱包必须完全保持不变。

## R4 支付、拒绝与恢复

`POST /orders/{id}/pay` 输入 `{paymentToken}`，只接受 ok / declined。reserved + ok → paid，返回 200 和订单，余额减少 quantity*10，charges 增加一次；库存仍被消费，不再额外减少。

reserved + declined 返回 402，订单仍为 reserved，余额、charges、库存全部保持原值；随后用 ok 可以正常支付，最终只扣一次款。declined 是本文允许控制的模拟依赖拒绝模式，不要自行增加超时或未知提交状态的预期。

已 paid 的订单以 ok 重复支付返回 200 和同一订单，不重复扣款或增加 charges。cancelled 订单支付返回 409，订单、库存和钱包不变。已存在订单的非所属身份进行 pay/cancel 返回 403 且不改变状态。

## R5 并发历史

对同一个 reserved 订单同时发出两个 ok 支付，两次都应返回 200，最终为 paid、余额只减少一次 quantity*10、charges 只增加一次、库存不额外减少。必须同时检查两个响应与最终状态；框架 parallel 支持最多 4 个并发请求，不用 sleep 代替并发。

## 范围与交付

重点调查正常状态转换后再重放、拒绝后的状态及恢复、跨身份幂等作用域、并发最终状态、库存与钱包关系。仅断言上文已经定义的行为。缺少的行为记录问题，不推测。生成一个继承 `framework.BlackBoxCase` 的 Python unittest 文件；只导入 unittest / framework，只用框架 call / parallel，每个独立旅程放在同一个 test_ 方法内，捕获运行时 id，保留有意义的中间断言。
