# 支付拒绝后恢复的黑盒题目

仅提供题目和 framework，没有系统源码。每个独立测试开始时 fixture 恢复初始状态，没有订单；测试身份固定为框架 user 参数 user-a。只测试以下单一旅程，固定 quantity=1，不涉及余额、库存断言、并发、取消、重放、其他身份或非法输入。

1. `POST /orders` 提交 `{quantity:1,requestId:"journey"}`，返回 201 和 JSON `{id,owner,quantity,state:"reserved"}`；id 为运行时生成值，必须保存并用于后续调用。
2. `POST /orders/{id}/pay` 提交 `{paymentToken:"declined"}`，返回 402，订单保持 reserved。通过 `GET /orders/{id}` 读取，返回 200 和该订单 JSON，可检查 state。
3. 对同一个订单 `POST /orders/{id}/pay` 提交 `{paymentToken:"ok"}`，返回 200 和 state=paid 的订单。随后 `GET /orders/{id}` 返回 200 和 state=paid 的同一订单。

本轮要求覆盖完整拒绝后恢复旅程，单次独立测试内完成所有调用和中间观察。其他行为未定义，不补充预期。
