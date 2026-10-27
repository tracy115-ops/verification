import unittest
from framework import BlackBoxCase


class GamePlatformTests(BlackBoxCase):
    def test_room_capacity_lower_boundary(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'mode': 'duel', 'ranked': False})
        self.assertEqual(response.status, 201)
        self.assertIn('id', response.body)

    def test_room_capacity_upper_boundary(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 8, 'mode': 'squad', 'ranked': False})
        self.assertEqual(response.status, 201)
        self.assertIn('id', response.body)

    def test_room_capacity_outside_boundaries(self):
        for capacity in (1, 9):
            with self.subTest(capacity=capacity):
                response = self.client.call('POST', '/rooms', {'maxPlayers': capacity, 'mode': 'duel', 'ranked': False})
                self.assertEqual(response.status, 400)

    def test_room_capacity_type_equivalence(self):
        for capacity in ('2', None, 2.5, True):
            with self.subTest(capacity=capacity):
                response = self.client.call('POST', '/rooms', {'maxPlayers': capacity, 'mode': 'duel', 'ranked': False})
                self.assertEqual(response.status, 400)

    def test_room_integral_float_capacity(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2.0, 'mode': 'duel', 'ranked': False})
        self.assertEqual(response.status, 201)
        self.assertIn('id', response.body)

    def test_room_mode_invalid(self):
        for mode in ('other', None, 2):
            with self.subTest(mode=mode):
                response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'mode': mode, 'ranked': False})
                self.assertEqual(response.status, 400)

    def test_room_ranked_requires_boolean(self):
        for ranked in ('true', None, 1):
            with self.subTest(ranked=ranked):
                response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'mode': 'duel', 'ranked': ranked})
                self.assertEqual(response.status, 400)

    def test_ranked_duel_two_players_valid(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'mode': 'duel', 'ranked': True})
        self.assertEqual(response.status, 201)
        self.assertIn('id', response.body)

    def test_ranked_squad_two_players_invalid(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'mode': 'squad', 'ranked': True})
        self.assertEqual(response.status, 400)

    def test_ranked_duel_more_than_two_invalid(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 3, 'mode': 'duel', 'ranked': True})
        self.assertEqual(response.status, 400)

    def test_ranked_squad_more_than_two_invalid(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 3, 'mode': 'squad', 'ranked': True})
        self.assertEqual(response.status, 400)

    def test_unranked_squad_two_players_valid(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 2, 'mode': 'squad', 'ranked': False})
        self.assertEqual(response.status, 201)
        self.assertIn('id', response.body)

    def test_unranked_duel_more_than_two_valid(self):
        response = self.client.call('POST', '/rooms', {'maxPlayers': 3, 'mode': 'duel', 'ranked': False})
        self.assertEqual(response.status, 201)
        self.assertIn('id', response.body)

    def test_private_room_owner_can_read(self):
        response = self.client.call('GET', '/rooms/private-room', user='player-a')
        self.assertEqual(response.status, 200)
        self.assertEqual(response.body['owner'], 'player-a')
        self.assertEqual(response.body['members'], ['player-a'])
        self.assertEqual(response.body['maxPlayers'], 2)

    def test_private_room_nonmember_forbidden(self):
        response = self.client.call('GET', '/rooms/private-room', user='player-b')
        self.assertEqual(response.status, 403)

    def test_private_room_requires_identity(self):
        response = self.client.call('GET', '/rooms/private-room', user=None)
        self.assertEqual(response.status, 401)

    def test_public_room_single_join(self):
        response = self.client.call('POST', '/rooms/race-room/join', user='player-b')
        self.assertEqual(response.status, 200)

    def test_public_room_concurrent_capacity(self):
        responses = self.client.parallel([
            {'method': 'POST', 'path': '/rooms/race-room/join', 'user': 'player-b'},
            {'method': 'POST', 'path': '/rooms/race-room/join', 'user': 'player-c'},
        ])
        self.assertCountEqual([response.status for response in responses], [200, 409])
        room = self.client.call('GET', '/rooms/race-room')
        self.assertEqual(len(room.body['members']), 2)

    def test_room_endpoints_require_identity(self):
        requests = [
            ('POST', '/rooms', {'maxPlayers': 2, 'mode': 'duel', 'ranked': False}),
            ('POST', '/rooms/race-room/join', None),
            ('GET', '/rooms/race-room', None),
        ]
        for method, path, body in requests:
            with self.subTest(path=path):
                response = self.client.call(method, path, body, user=None)
                self.assertEqual(response.status, 401)

    def test_live_attack_advances_turn(self):
        response = self.client.call('POST', '/matches/live/actions', {'turn': 3, 'action': 'attack'})
        self.assertEqual(response.status, 200)
        self.assertEqual(response.body['currentTurn'], 4)

    def test_live_defend_advances_turn(self):
        response = self.client.call('POST', '/matches/live/actions', {'turn': 3, 'action': 'defend'})
        self.assertEqual(response.status, 200)
        self.assertEqual(response.body['currentTurn'], 4)

    def test_live_stale_turn_rejected(self):
        response = self.client.call('POST', '/matches/live/actions', {'turn': 2, 'action': 'attack'})
        self.assertEqual(response.status, 409)

    def test_live_replayed_action_is_stale(self):
        action = {'turn': 3, 'action': 'attack'}
        first = self.client.call('POST', '/matches/live/actions', action)
        self.assertEqual(first.status, 200)
        self.assertEqual(first.body['currentTurn'], 4)
        replay = self.client.call('POST', '/matches/live/actions', action)
        self.assertEqual(replay.status, 409)

    def test_live_nonparticipant_forbidden(self):
        response = self.client.call('POST', '/matches/live/actions', {'turn': 3, 'action': 'attack'}, user='player-c')
        self.assertEqual(response.status, 403)

    def test_finished_match_rejects_actions(self):
        for action in ('attack', 'defend'):
            with self.subTest(action=action):
                response = self.client.call('POST', '/matches/finished/actions', {'turn': 3, 'action': action}, user='player-a')
                self.assertEqual(response.status, 409)
        response = self.client.call('POST', '/matches/finished/actions', {'turn': 3, 'action': 'attack'}, user='player-b')
        self.assertEqual(response.status, 409)

    def test_result_first_submission_scores_winner(self):
        before = self.client.call('GET', '/players/player-a/score')
        self.assertEqual(before.status, 200)
        self.assertEqual(before.body['score'], 0)
        result = self.client.call('POST', '/matches/result/result', {'winnerId': 'player-a', 'submissionId': 'submission-1'})
        self.assertEqual(result.status, 200)
        after = self.client.call('GET', '/players/player-a/score')
        self.assertEqual(after.status, 200)
        self.assertEqual(after.body['score'], 10)

    def test_result_replay_does_not_score_twice(self):
        result = {'winnerId': 'player-a', 'submissionId': 'submission-1'}
        first = self.client.call('POST', '/matches/result/result', result)
        replay = self.client.call('POST', '/matches/result/result', result)
        self.assertEqual(first.status, 200)
        self.assertEqual(replay.status, 200)
        score = self.client.call('GET', '/players/player-a/score')
        self.assertEqual(score.status, 200)
        self.assertEqual(score.body['score'], 10)

    def test_match_and_score_endpoints_require_identity(self):
        requests = [
            ('POST', '/matches/live/actions', {'turn': 3, 'action': 'attack'}),
            ('POST', '/matches/finished/actions', {'turn': 3, 'action': 'attack'}),
            ('GET', '/players/player-a/score', None),
        ]
        for method, path, body in requests:
            with self.subTest(path=path):
                response = self.client.call(method, path, body, user=None)
                self.assertEqual(response.status, 401)

    def test_queue_lower_boundary_cn(self):
        response = self.client.call('POST', '/queue', {'level': 1, 'region': 'cn'})
        self.assertEqual(response.status, 200)
        self.assertEqual(response.body['status'], 'queued')

    def test_queue_upper_boundary_eu(self):
        response = self.client.call('POST', '/queue', {'level': 100, 'region': 'eu'})
        self.assertEqual(response.status, 200)
        self.assertEqual(response.body['status'], 'queued')

    def test_queue_level_outside_boundaries(self):
        for level in (0, 101):
            with self.subTest(level=level):
                response = self.client.call('POST', '/queue', {'level': level, 'region': 'cn'})
                self.assertEqual(response.status, 400)

    def test_queue_level_type_equivalence(self):
        for level in ('2', None, 2.5, True):
            with self.subTest(level=level):
                response = self.client.call('POST', '/queue', {'level': level, 'region': 'cn'})
                self.assertEqual(response.status, 400)

    def test_queue_integral_float_level(self):
        response = self.client.call('POST', '/queue', {'level': 2.0, 'region': 'cn'})
        self.assertEqual(response.status, 200)
        self.assertEqual(response.body['status'], 'queued')

    def test_queue_invalid_region(self):
        for region in ('us', None, 1):
            with self.subTest(region=region):
                response = self.client.call('POST', '/queue', {'level': 50, 'region': region})
                self.assertEqual(response.status, 400)

    def test_queue_requires_identity(self):
        response = self.client.call('POST', '/queue', {'level': 50, 'region': 'cn'}, user=None)
        self.assertEqual(response.status, 401)

    def test_queue_matchmaker_unavailable(self):
        response = self.client.call('POST', '/queue', {'level': 50, 'region': 'cn'}, headers={'X-Test-Matchmaker': 'unavailable'})
        self.assertEqual(response.status, 503)
        self.assertEqual(response.body['status'], 'unavailable')
