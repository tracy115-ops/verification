from framework import BlackBoxCase


class TestRankedRoom(BlackBoxCase):
    def test_ranked_duel_three_players_returns_400(self):
        body = {"maxPlayers": 3, "mode": "duel", "ranked": True}
        response = self.client.call("POST", "/rooms", body, user="player-a")
        self.assertEqual(response.status, 400)
