# 订单支付重放黑盒验证（桌面实机）

本轮仅覆盖以下两个场景：首次成功支付，以及同一已支付订单的顺序重放。拒付、取消、并发、其他身份、非法参数和创建请求幂等不在本轮范围。没有代码，仅通过给定 JSON 接口和提供的 Python 框架验证。

## 初始状态与身份
每条用例的框架 setUp 调用 POST /__fixture/reset 恢复独立状态。身份固定 user-a，钱包初始 balance=100、charges=0，库存 available=4。self.client.call(method,path,body=None,user="user-a") 返回对象，其 status 是 HTTP 状态，body 是 JSON；不需要额外鉴权。每条用例从独立状态开始，不复用其他用例订单。

## 创建前置订单
POST /orders 输入 {"quantity":2,"requestId":"本用例内非空字符串"} 返回 201，JSON 含 id（非空字符串）、owner="user-a"、quantity=2、state="reserved"。创建后库存 available=2，钱包仍为 balance=100、charges=0。后续路径使用此响应的真实 id，不猜测订单编号。创建仅是支付测试的前置步骤，本轮不扩展创建接口其他参数组合。

## 首次成功支付
POST /orders/{id}/pay 输入 {"paymentToken":"ok"} 返回 200，JSON 含同一 id、owner="user-a"、quantity=2、state="paid"。首次成功支付后钱包 balance=80、charges=1；库存仍为 available=2；订单最终为 paid。

## 顺序重放
同一用例中首次成功支付后，再顺序提交相同 POST /orders/{id}/pay 和 {"paymentToken":"ok"}。返回仍为 200、同一订单 state="paid"。不得再次扣款：钱包必须保持 balance=80、charges=1；库存保持 available=2；订单状态仍为 paid。必须检查钱包与库存的实际响应，不能只检查支付返回成功。

## 只读观察接口
GET /wallet 返回 200 和 {"balance":整数,"charges":整数}，属于当前 user-a。
GET /inventory 返回 200 和 {"available":整数}。
GET /orders/{id} 返回 200 及同一订单 id、owner、quantity、state。
所有上述调用都通过框架，失败断言和请求响应作为证据；不得断言未定义字段。
