"""支付拒绝后恢复旅程的黑盒测试（题目：game-unittest / Native journey end-to-end）。

覆盖已批准用例 TC-decline-recover-journey：
创建订单 -> 支付被拒(402) -> 读回(reserved) -> 重试支付成功(200, paid) -> 读回(同一订单, paid)。

范围说明（审计备注）：
- 仅使用题目声明的接口：POST /orders、POST /orders/{id}/pay、GET /orders/{id}。
- 固定 quantity=1、requestId="journey"、paymentToken 仅用 "declined" 与 "ok"，身份固定 user-a。
- 不做余额、库存、并发、重放、取消或其他身份的断言；未定义行为不补充预期。
- framework.BlackBoxCase.setUp 已在每 个独立测试前调用 POST /__fixture/reset 恢复初始状态。
- 本轮为单旅程场景，不声明 journey 结构以外的状态迁移，不伪造并发或补偿用例。
"""
import framework


class TestDeclineRecoverJourney(framework.BlackBoxCase):
    """完整拒绝后恢复旅程：所有调用与中间观察在单个独立测试内完成。"""

    def test_decline_then_retry_pay_full_journey(self):
        # 步骤 1：以 user-a 创建订单，quantity=1，requestId="journey"。
        create = self.client.call(
            "POST", "/orders", {"quantity": 1, "requestId": "journey"}, user="user-a"
        )
        self.assertEqual(
            201, create.status,
            "POST /orders 应返回 201，实际：%s %s" % (create.status, create.body),
        )
        create_body = create.body
        for field in ("id", "owner", "quantity", "state"):
            self.assertIn(field, create_body, "创建响应 JSON 缺少字段 %s：%s" % (field, create_body))
        self.assertEqual(
            "reserved", create_body["state"],
            "创建后订单 state 应为 reserved，实际：%s" % (create_body["state"],),
        )
        order_id = create_body["id"]  # 保存运行时生成的 id 供后续调用使用

        # 步骤 2：对保存的 id 提交 paymentToken="declined" 的支付，应返回 402。
        declined = self.client.call(
            "POST", "/orders/%s/pay" % order_id, {"paymentToken": "declined"}, user="user-a"
        )
        self.assertEqual(
            402, declined.status,
            "paymentToken=declined 的支付应返回 402，实际：%s %s" % (declined.status, declined.body),
        )

        # 步骤 3：拒绝后读回订单，确认状态仍保持 reserved（未改变）。
        read_after_decline = self.client.call("GET", "/orders/%s" % order_id, user="user-a")
        self.assertEqual(
            200, read_after_decline.status,
            "拒绝支付后 GET /orders/{id} 应返回 200，实际：%s %s" % (
                read_after_decline.status, read_after_decline.body,
            ),
        )
        self.assertEqual(
            "reserved", read_after_decline.body.get("state"),
            "拒绝支付后订单 state 应保持 reserved，实际：%s" % (read_after_decline.body,),
        )

        # 步骤 4：对同一个订单（同一 id）以 paymentToken="ok" 重试支付，应返回 200 且 state=paid。
        paid = self.client.call(
            "POST", "/orders/%s/pay" % order_id, {"paymentToken": "ok"}, user="user-a"
        )
        self.assertEqual(
            200, paid.status,
            "重试支付 paymentToken=ok 应返回 200，实际：%s %s" % (paid.status, paid.body),
        )
        self.assertEqual(
            "paid", paid.body.get("state"),
            "支付成功响应中订单 state 应为 paid，实际：%s" % (paid.body,),
        )

        # 步骤 5：最终读回，核对为同一订单（相同 id）且 state=paid。
        read_final = self.client.call("GET", "/orders/%s" % order_id, user="user-a")
        self.assertEqual(
            200, read_final.status,
            "最终 GET /orders/{id} 应返回 200，实际：%s %s" % (
                read_final.status, read_final.body,
            ),
        )
        self.assertEqual(
            order_id, read_final.body.get("id"),
            "最终读回应为同一订单（id 相同），期望 %s，实际：%s" % (order_id, read_final.body),
        )
        self.assertEqual(
            "paid", read_final.body.get("state"),
            "最终读回订单 state 应为 paid，实际：%s" % (read_final.body,),
        )
