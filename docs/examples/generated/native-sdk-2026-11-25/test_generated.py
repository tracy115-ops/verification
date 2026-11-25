# =====================================================================
# 黑盒测试脚本：支付拒绝后恢复旅程
# 对应批准用例：C1_decline_then_recover_journey（scenario S1_decline_then_recover_journey）
# 关联需求：PRECONDITION-STATE、ORDER-CREATE、PAY-DECLINED、
#           ORDER-READ-AFTER-DECLINED、PAY-RECOVER、ORDER-READ-PAID
# 范围与审计备注：
#   - 每个独立测试开始时，框架 setUp 调用 POST /__fixture/reset 恢复初始状态，系统中没有订单。
#   - 测试身份固定为框架 user 参数 user-a；quantity 固定为 1；requestId 固定为 "journey"。
#   - sourceSpec 声明其余行为未定义：余额与库存断言、并发、取消、重放、
#     其他身份、非法输入均不在批准范围内，本脚本不补充任何预期。
#   - reviewExclusions 为空，无其他排除项；本脚本尚未执行（No test execution has occurred）。
# =====================================================================

import unittest

import framework


class TestC1DeclineThenRecoverJourney(framework.BlackBoxCase):
    # 批准用例 C1_decline_then_recover_journey：完整拒绝后恢复旅程；
    # 全部调用与中间观察必须在同一独立测试方法内按序完成（setUp 已重置 fixture）。
    def test_c1_decline_then_recover_full_journey(self):
        # 步骤 1（ORDER-CREATE）：以 user-a 创建订单，quantity=1，requestId="journey"。
        created = self.client.call(
            "POST",
            "/orders",
            {"quantity": 1, "requestId": "journey"},
            user="user-a",
        )
        self.assertEqual(created.status, 201, "创建订单应返回 201")
        self.assertIsInstance(created.body, dict, "创建响应应为 JSON 对象")
        self.assertIn("id", created.body, "创建响应应包含字段 id")
        self.assertIn("owner", created.body, "创建响应应包含字段 owner")
        self.assertIn("quantity", created.body, "创建响应应包含字段 quantity")
        self.assertIn("state", created.body, "创建响应应包含字段 state")
        self.assertEqual(created.body["state"], "reserved", "新建订单 state 应为 reserved")
        self.assertEqual(created.body["quantity"], 1, "新建订单 quantity 应为 1")
        # 保存运行时生成的 id，后续 pay 与 GET 调用复用同一 id。
        order_id = created.body["id"]

        # 步骤 2（PAY-DECLINED）：对保存的同一 id 提交 paymentToken="declined"。
        declined = self.client.call(
            "POST",
            f"/orders/{order_id}/pay",
            {"paymentToken": "declined"},
            user="user-a",
        )
        self.assertEqual(declined.status, 402, "declined 支付应返回 402")

        # 步骤 3（ORDER-READ-AFTER-DECLINED）：读取订单，确认拒绝支付后状态未变。
        after_declined = self.client.call("GET", f"/orders/{order_id}", user="user-a")
        self.assertEqual(after_declined.status, 200, "拒绝支付后读取订单应返回 200")
        self.assertIsInstance(after_declined.body, dict, "订单读取响应应为 JSON 对象")
        self.assertEqual(after_declined.body.get("id"), order_id, "读取到的应为同一订单")
        self.assertEqual(after_declined.body.get("state"), "reserved", "拒绝支付后订单应保持 reserved")

        # 步骤 4（PAY-RECOVER）：对被拒后的同一 id 再次支付，paymentToken="ok"。
        paid = self.client.call(
            "POST",
            f"/orders/{order_id}/pay",
            {"paymentToken": "ok"},
            user="user-a",
        )
        self.assertEqual(paid.status, 200, "ok 支付应返回 200")
        self.assertEqual(paid.body.get("state"), "paid", "ok 支付返回的订单 state 应为 paid")

        # 步骤 5（ORDER-READ-PAID）：再次读取订单，确认 state=paid 且 id 与保存值一致。
        after_paid = self.client.call("GET", f"/orders/{order_id}", user="user-a")
        self.assertEqual(after_paid.status, 200, "支付成功后读取订单应返回 200")
        self.assertIsInstance(after_paid.body, dict, "订单读取响应应为 JSON 对象")
        self.assertEqual(after_paid.body.get("id"), order_id, "最终读取的订单 id 应与保存值一致")
        self.assertEqual(after_paid.body.get("state"), "paid", "最终订单 state 应为 paid")
