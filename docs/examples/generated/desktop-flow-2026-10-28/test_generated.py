import unittest
import framework


# Scope gaps: currentTurn and finished-match state have no specified
# observation interface. Result-submission authentication status conflicts
# in the contract; the unauthenticated smoke test only checks JSON.
# Invalid winnerId (B5-C13_01 / S13), unspecified action and result
# semantics, serial full-room and duplicate-join behavior, player-b scoring,
# and unavailable-service precedence remain outside the approved scope.

class TestGamePlatform(framework.BlackBoxCase):
    def test_b1_c01(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'mode': 'duel', 'ranked': False})
        self.assertEqual(response.status, 201)
        self.assertIsInstance(response.body, dict)
        self.assertIn('id', response.body)

    def test_b1_c02(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 8, 'mode': 'squad', 'ranked': False})
        self.assertEqual(response.status, 201)
        self.assertIsInstance(response.body, dict)
        self.assertIn('id', response.body)

    def test_b1_c03(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 4, 'mode': 'duel', 'ranked': False})
        self.assertEqual(response.status, 201)
        self.assertIsInstance(response.body, dict)
        self.assertIn('id', response.body)

    def test_b1_c04(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'mode': 'duel', 'ranked': True})
        self.assertEqual(response.status, 201)
        self.assertIsInstance(response.body, dict)
        self.assertIn('id', response.body)

    def test_b1_c05(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'mode': 'squad', 'ranked': True})
        self.assertEqual(response.status, 400)

    def test_b1_c06(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 3, 'mode': 'duel', 'ranked': True})
        self.assertEqual(response.status, 400)

    def test_b1_c07(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 1, 'mode': 'duel', 'ranked': False})
        self.assertEqual(response.status, 400)

    def test_b1_c08(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 9, 'mode': 'duel', 'ranked': False})
        self.assertEqual(response.status, 400)

    def test_b1_c09(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2.5, 'mode': 'duel', 'ranked': False})
        self.assertEqual(response.status, 400)

    def test_b1_c10(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': '2', 'mode': 'duel', 'ranked': False})
        self.assertEqual(response.status, 400)

    def test_b1_c11(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': True, 'mode': 'duel', 'ranked': False})
        self.assertEqual(response.status, 400)

    def test_b1_c12(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': None, 'mode': 'duel', 'ranked': False})
        self.assertEqual(response.status, 400)

    def test_b1_c13(self):
        response = self.client.call('POST', '/rooms', {'mode': 'duel', 'ranked': False})
        self.assertEqual(response.status, 400)

    def test_b2_c4_01(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'mode': 'other', 'ranked': False})
        self.assertEqual(response.status, 400)

    def test_b2_c4_02(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'ranked': False})
        self.assertEqual(response.status, 400)

    def test_b2_c4_03(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'mode': 'duel', 'ranked': 1})
        self.assertEqual(response.status, 400)

    def test_b2_c4_04(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'mode': 'duel'})
        self.assertEqual(response.status, 400)

    def test_b2_c5_01(self):
        response = self.client.call('GET', '/rooms/private-room', user='player-a')
        self.assertEqual(response.status, 200)
        self.assertEqual(response.body['owner'], 'player-a')
        self.assertEqual(response.body['members'], ['player-a'])
        self.assertEqual(response.body['maxPlayers'], 2)

    def test_b2_c5_02(self):
        response = self.client.call('GET', '/rooms/private-room', user='player-b')
        self.assertEqual(response.status, 403)

    def test_b2_c5_03(self):
        response = self.client.call('GET', '/rooms/private-room', user=None)
        self.assertEqual(response.status, 401)

    def test_b2_c6_01(self):
        joined = self.client.call('POST', '/rooms/race-room/join', user='player-b')
        self.assertEqual(joined.status, 200)
        room = self.client.call('GET', '/rooms/race-room', user='player-a')
        self.assertEqual(len(room.body['members']), 2)

    def test_b3_c7_1(self):
        responses = self.client.parallel([
            {'method': 'POST', 'path': '/rooms/race-room/join', 'user': 'player-b'},
            {'method': 'POST', 'path': '/rooms/race-room/join', 'user': 'player-c'},
        ])
        self.assertCountEqual([response.status for response in responses], [200, 409])
        room = self.client.call('GET', '/rooms/race-room', user='player-a')
        self.assertEqual(len(room.body['members']), 2)

    def test_b3_c8_1(self):
        requests = [
            ('POST', '/rooms', {'maxPlayers': 2, 'mode': 'duel', 'ranked': False}),
            ('GET', '/rooms/private-room', None),
            ('POST', '/rooms/race-room/join', None),
            ('GET', '/rooms/race-room', None),
            ('POST', '/matches/live/actions', {'turn': 3, 'action': 'attack'}),
            ('POST', '/matches/finished/actions', {'turn': 3, 'action': 'attack'}),
            ('GET', '/players/player-a/score', None),
            ('POST', '/queue', {'level': 1, 'region': 'cn'}),
        ]
        for method, path, body in requests:
            with self.subTest(method=method, path=path):
                response = self.client.call(method, path, body, user=None)
                self.assertEqual(response.status, 401)
                self.assertIsInstance(response.body, (dict, list, str, int, float, bool, type(None)))

    def test_b3_c8_2(self):
        response = self.client.call('POST', '/matches/result/result', {'winnerId': 'player-a', 'submissionId': 'unauthenticated-1'}, user=None)
        self.assertIsInstance(response.body, dict)

    def test_b3_c9_1(self):
        response = self.client.call('POST', '/matches/live/actions', {'turn': 3, 'action': 'attack'}, user='player-a')
        self.assertEqual(response.status, 200)

    def test_b3_c9_2(self):
        response = self.client.call('POST', '/matches/live/actions', {'turn': 3, 'action': 'defend'}, user='player-a')
        self.assertEqual(response.status, 200)

    def test_b4_c10_01(self):
        response = self.client.call('POST', '/matches/live/actions', {'turn': 2, 'action': 'attack'}, user='player-a')
        self.assertEqual(response.status, 409)
        self.assertIsInstance(response.body, (dict, list, str, int, float, bool, type(None)))

    def test_b4_c10_02(self):
        response = self.client.call('POST', '/matches/live/actions', {'turn': 3, 'action': 'defend'}, user='player-c')
        self.assertEqual(response.status, 403)
        self.assertIsInstance(response.body, (dict, list, str, int, float, bool, type(None)))

    def test_b4_c11_01(self):
        response = self.client.call('POST', '/matches/finished/actions', {'turn': 3, 'action': 'attack'}, user='player-a')
        self.assertEqual(response.status, 409)
        self.assertIsInstance(response.body, (dict, list, str, int, float, bool, type(None)))

    def test_b4_c12_01(self):
        body = {'winnerId': 'player-a', 'submissionId': 'submission-1'}
        first = self.client.call('POST', '/matches/result/result', body, user='player-a')
        self.assertEqual(first.status, 200)
        self.assertIsInstance(first.body, (dict, list, str, int, float, bool, type(None)))
        first_score = self.client.call('GET', '/players/player-a/score', user='player-a')
        self.assertIsInstance(first_score.body, dict)
        self.assertEqual(first_score.body['score'], 10)
        replay = self.client.call('POST', '/matches/result/result', body, user='player-a')
        self.assertEqual(replay.status, 200)
        self.assertIsInstance(replay.body, (dict, list, str, int, float, bool, type(None)))
        replay_score = self.client.call('GET', '/players/player-a/score', user='player-a')
        self.assertIsInstance(replay_score.body, dict)
        self.assertEqual(replay_score.body['score'], 10)

    def test_b5_c14_01_min(self):
        response = self.client.call('POST', '/queue', {'level': 1, 'region': 'cn'}, user='player-a')
        self.assertEqual(response.status, 200)
        self.assertEqual(response.body['status'], 'queued')

    def test_b5_c14_01_max(self):
        response = self.client.call('POST', '/queue', {'level': 100, 'region': 'eu'}, user='player-a')
        self.assertEqual(response.status, 200)
        self.assertEqual(response.body['status'], 'queued')

    def test_b5_c14_01_middle(self):
        response = self.client.call('POST', '/queue', {'level': 50, 'region': 'cn'}, user='player-a')
        self.assertEqual(response.status, 200)
        self.assertEqual(response.body['status'], 'queued')

    def test_b5_c15_01_low(self):
        response = self.client.call('POST', '/queue', {'level': 0, 'region': 'cn'}, user='player-a')
        self.assertEqual(response.status, 400)

    def test_b5_c15_01_high(self):
        response = self.client.call('POST', '/queue', {'level': 101, 'region': 'cn'}, user='player-a')
        self.assertEqual(response.status, 400)

    def test_b5_c15_02_fraction(self):
        response = self.client.call('POST', '/queue', {'level': 1.5, 'region': 'cn'}, user='player-a')
        self.assertEqual(response.status, 400)

    def test_b5_c15_02_string(self):
        response = self.client.call('POST', '/queue', {'level': '50', 'region': 'cn'}, user='player-a')
        self.assertEqual(response.status, 400)

    def test_b5_c15_02_null(self):
        response = self.client.call('POST', '/queue', {'level': None, 'region': 'cn'}, user='player-a')
        self.assertEqual(response.status, 400)

    def test_b5_c15_02_missing(self):
        response = self.client.call('POST', '/queue', {'region': 'cn'}, user='player-a')
        self.assertEqual(response.status, 400)

    def test_b5_c15_03_invalid(self):
        response = self.client.call('POST', '/queue', {'level': 50, 'region': 'us'}, user='player-a')
        self.assertEqual(response.status, 400)

    def test_b5_c15_03_null(self):
        response = self.client.call('POST', '/queue', {'level': 50, 'region': None}, user='player-a')
        self.assertEqual(response.status, 400)

    def test_b5_c15_03_missing(self):
        response = self.client.call('POST', '/queue', {'level': 50}, user='player-a')
        self.assertEqual(response.status, 400)

    def test_b6_c16_01(self):
        response = self.client.call('POST', '/queue', {'level': 1, 'region': 'cn'}, user='player-a', headers={'X-Test-Matchmaker': 'unavailable'})
        self.assertEqual(response.status, 503)
        self.assertIsInstance(response.body, dict)
        self.assertEqual(response.body['status'], 'unavailable')

    def test_b6_c17_01(self):
        response = self.client.call('GET', '/rooms/private-room', user='player-a')
        self.assertEqual(response.status, 200)
        self.assertIsInstance(response.body, (dict, list, str, int, float, bool, type(None)))
