# 黑盒房间容量验证脚本（单文件 unittest 适配器）。
# 范围说明：仅覆盖四个已批准用例（SC-CAP-2-VALID-201、SC-CAP-8-VALID-201、
# SC-CAP-1-INVALID-400、SC-CAP-9-INVALID-400），按声明的 oracle 只断言 HTTP 状态码。
# 审计备注（非阻塞问题）：其他输入组合、鉴权变体、缺失字段、响应体字段断言、
# 并发行为与依赖故障均被明确排除在范围之外；固定前置条件（player-a、mode=duel、
# ranked=false、每测试独立夹具重置）按规约不单独建测，由框架 setUp 统一提供。
import unittest

import framework


class RoomCapacityBlackBoxTests(framework.BlackBoxCase):
    def test_cap_1_invalid_returns_400(self):
        response = self.client.call(
            "POST",
            "/rooms",
            {"maxPlayers": 1, "mode": "duel", "ranked": False},
            user="player-a",
        )
        self.assertEqual(400, response.status)

    def test_cap_2_valid_returns_201(self):
        response = self.client.call(
            "POST",
            "/rooms",
            {"maxPlayers": 2, "mode": "duel", "ranked": False},
            user="player-a",
        )
        self.assertEqual(201, response.status)

    def test_cap_8_valid_returns_201(self):
        response = self.client.call(
            "POST",
            "/rooms",
            {"maxPlayers": 8, "mode": "duel", "ranked": False},
            user="player-a",
        )
        self.assertEqual(201, response.status)

    def test_cap_9_invalid_returns_400(self):
        response = self.client.call(
            "POST",
            "/rooms",
            {"maxPlayers": 9, "mode": "duel", "ranked": False},
            user="player-a",
        )
        self.assertEqual(400, response.status)
