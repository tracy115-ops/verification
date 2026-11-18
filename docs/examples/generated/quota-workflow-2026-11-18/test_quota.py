from framework import BlackBoxCase


class TestTenantQuota(BlackBoxCase):
    def test_identity_and_initial_quota(self):
        for user in ("player-a", "player-b"):
            response = self.client.call("GET", "/quota", user=user)
            self.assertEqual(response.status, 200)
            self.assertEqual(response.body, {"available": 4, "consumed": 0})
        default = self.client.call("GET", "/quota")
        self.assertEqual(default.status, 200)
        self.assertEqual(default.body, {"available": 4, "consumed": 0})
        for user in (None, "unknown-player"):
            self.assertEqual(self.client.call("GET", "/quota", user=user).status, 401)

    def test_valid_boundaries_and_tenant_quotas(self):
        for user in ("player-a", "player-b"):
            initial = self.client.call("GET", "/quota", user=user)
            self.assertEqual(initial.status, 200)
            self.assertEqual(initial.body, {"available": 4, "consumed": 0})
        key_b = "B1234567890123456789012345678901"
        a = self.client.call("POST", "/holds", {"units": 1, "key": "A"}, user="player-a")
        b = self.client.call("POST", "/holds", {"units": 4, "key": key_b}, user="player-b")
        for response, owner, units, key in ((a, "player-a", 1, "A"), (b, "player-b", 4, key_b)):
            self.assertEqual(response.status, 201)
            self.assertIn("id", response.body)
            for field, value in (("owner", owner), ("units", units), ("key", key), ("state", "active")):
                self.assertEqual(response.body[field], value)
        self.assertNotEqual(a.body["id"], b.body["id"])
        for user, available, units in (("player-a", 3, 1), ("player-b", 0, 4)):
            quota = self.client.call("GET", "/quota", user=user)
            self.assertEqual(quota.status, 200)
            self.assertEqual(quota.body, {"available": available, "consumed": 0})
            self.assertEqual(quota.body["available"] + units + quota.body["consumed"], 4)

    def test_invalid_units_preserve_both_quotas(self):
        initial = {}
        for user in ("player-a", "player-b"):
            quota = self.client.call("GET", "/quota", user=user)
            self.assertEqual(quota.status, 200)
            self.assertEqual(quota.body, {"available": 4, "consumed": 0})
            initial[user] = quota.body
        bodies = [{"units": value, "key": "K1"} for value in (True, 1.5, 0, 5, "2", None)]
        bodies.append({"key": "K1"})
        for body in bodies:
            self.assertEqual(self.client.call("POST", "/holds", body).status, 400)
            for user in ("player-a", "player-b"):
                quota = self.client.call("GET", "/quota", user=user)
                self.assertEqual(quota.status, 200)
                self.assertEqual(quota.body, initial[user])

    def test_invalid_keys_preserve_both_quotas(self):
        initial = {}
        for user in ("player-a", "player-b"):
            quota = self.client.call("GET", "/quota", user=user)
            self.assertEqual(quota.status, 200)
            self.assertEqual(quota.body, {"available": 4, "consumed": 0})
            initial[user] = quota.body
        bodies = [{"units": 1, "key": key} for key in ("", "A" * 33, "A_B", "é", None)]
        bodies.append({"units": 1})
        for body in bodies:
            self.assertEqual(self.client.call("POST", "/holds", body).status, 400)
            for user in ("player-a", "player-b"):
                quota = self.client.call("GET", "/quota", user=user)
                self.assertEqual(quota.status, 200)
                self.assertEqual(quota.body, initial[user])

    def test_rejected_key_succeeds_after_release(self):
        initial = self.client.call("GET", "/quota")
        self.assertEqual(initial.status, 200)
        self.assertEqual(initial.body, {"available": 4, "consumed": 0})
        first = self.client.call("POST", "/holds", {"units": 3, "key": "A"})
        self.assertEqual(first.status, 201)
        self.assertIn("id", first.body)
        for field, value in (("owner", "player-a"), ("units", 3), ("key", "A"), ("state", "active")):
            self.assertEqual(first.body[field], value)
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 1, "consumed": 0})
        self.assertEqual(self.client.call("POST", "/holds", {"units": 2, "key": "B"}).status, 409)
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 1, "consumed": 0})
        released = self.client.call("POST", "/holds/" + str(first.body["id"]) + "/release")
        self.assertEqual(released.status, 200)
        self.assertEqual(released.body["id"], first.body["id"])
        self.assertEqual(released.body["state"], "released")
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 4, "consumed": 0})
        second = self.client.call("POST", "/holds", {"units": 2, "key": "B"})
        self.assertEqual(second.status, 201)
        self.assertIn("id", second.body)
        self.assertNotEqual(second.body["id"], first.body["id"])
        for field, value in (("owner", "player-a"), ("units", 2), ("key", "B"), ("state", "active")):
            self.assertEqual(second.body[field], value)
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 2, "consumed": 0})
        self.assertEqual(quota.body["available"] + second.body["units"] + quota.body["consumed"], 4)

    def test_active_key_replay_and_conflict(self):
        body = {"units": 1, "key": "A"}
        first = self.client.call("POST", "/holds", body)
        self.assertEqual(first.status, 201)
        self.assertIn("id", first.body)
        for field, value in (("owner", "player-a"), ("units", 1), ("key", "A"), ("state", "active")):
            self.assertEqual(first.body[field], value)
        replay = self.client.call("POST", "/holds", body)
        self.assertEqual(replay.status, 200)
        for field in ("id", "owner", "units", "key", "state"):
            self.assertEqual(replay.body[field], first.body[field])
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 3, "consumed": 0})
        self.assertEqual(self.client.call("POST", "/holds", {"units": 2, "key": "A"}).status, 409)
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 3, "consumed": 0})
        current = self.client.call("GET", "/holds/" + str(first.body["id"]))
        self.assertEqual(current.status, 200)
        for field in ("id", "owner", "units", "key", "state"):
            self.assertEqual(current.body[field], first.body[field])

    def test_released_hold_replays_and_rejects_consume(self):
        body = {"units": 2, "key": "A"}
        created = self.client.call("POST", "/holds", body)
        self.assertEqual(created.status, 201)
        self.assertIn("id", created.body)
        for field, value in (("owner", "player-a"), ("units", 2), ("key", "A"), ("state", "active")):
            self.assertEqual(created.body[field], value)
        path = "/holds/" + str(created.body["id"])
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 2, "consumed": 0})
        for _ in range(2):
            released = self.client.call("POST", path + "/release")
            self.assertEqual(released.status, 200)
            self.assertEqual(released.body["id"], created.body["id"])
            self.assertEqual(released.body["state"], "released")
            quota = self.client.call("GET", "/quota")
            self.assertEqual(quota.status, 200)
            self.assertEqual(quota.body, {"available": 4, "consumed": 0})
        replay = self.client.call("POST", "/holds", body)
        self.assertEqual(replay.status, 200)
        for field, value in (("id", created.body["id"]), ("owner", "player-a"), ("units", 2), ("key", "A"), ("state", "released")):
            self.assertEqual(replay.body[field], value)
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 4, "consumed": 0})
        self.assertEqual(self.client.call("POST", path + "/consume").status, 409)
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 4, "consumed": 0})
        current = self.client.call("GET", path)
        self.assertEqual(current.status, 200)
        self.assertEqual(current.body["state"], "released")

    def test_consumed_hold_replays_and_rejects_release(self):
        body = {"units": 2, "key": "ConsumeReplay1"}
        created = self.client.call("POST", "/holds", body)
        self.assertEqual(created.status, 201)
        self.assertIn("id", created.body)
        for field, value in (("owner", "player-a"), ("units", 2), ("key", "ConsumeReplay1"), ("state", "active")):
            self.assertEqual(created.body[field], value)
        path = "/holds/" + str(created.body["id"])
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 2, "consumed": 0})
        for _ in range(2):
            consumed = self.client.call("POST", path + "/consume")
            self.assertEqual(consumed.status, 200)
            self.assertEqual(consumed.body["id"], created.body["id"])
            self.assertEqual(consumed.body["state"], "consumed")
            current = self.client.call("GET", path)
            self.assertEqual(current.status, 200)
            self.assertEqual(current.body["id"], created.body["id"])
            self.assertEqual(current.body["state"], "consumed")
            quota = self.client.call("GET", "/quota")
            self.assertEqual(quota.status, 200)
            self.assertEqual(quota.body, {"available": 2, "consumed": 2})
        replay = self.client.call("POST", "/holds", body)
        self.assertEqual(replay.status, 200)
        for field, value in (("id", created.body["id"]), ("owner", "player-a"), ("units", 2), ("key", "ConsumeReplay1"), ("state", "consumed")):
            self.assertEqual(replay.body[field], value)
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 2, "consumed": 2})
        self.assertEqual(self.client.call("POST", path + "/release").status, 409)
        current = self.client.call("GET", path)
        self.assertEqual(current.status, 200)
        self.assertEqual(current.body["id"], created.body["id"])
        self.assertEqual(current.body["state"], "consumed")
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 2, "consumed": 2})

    def test_shared_key_isolated_across_tenants(self):
        key = "SharedKey1"
        a = self.client.call("POST", "/holds", {"units": 2, "key": key}, user="player-a")
        b = self.client.call("POST", "/holds", {"units": 3, "key": key}, user="player-b")
        for response, owner, units in ((a, "player-a", 2), (b, "player-b", 3)):
            self.assertEqual(response.status, 201)
            self.assertIn("id", response.body)
            for field, value in (("owner", owner), ("units", units), ("key", key), ("state", "active")):
                self.assertEqual(response.body[field], value)
        self.assertNotEqual(a.body["id"], b.body["id"])
        path_a = "/holds/" + str(a.body["id"])
        path_b = "/holds/" + str(b.body["id"])
        for user, available in (("player-a", 2), ("player-b", 1)):
            quota = self.client.call("GET", "/quota", user=user)
            self.assertEqual(quota.status, 200)
            self.assertEqual(quota.body, {"available": available, "consumed": 0})
        self.assertEqual(self.client.call("GET", path_b, user="player-a").status, 403)
        self.assertEqual(self.client.call("GET", path_a, user="player-b").status, 403)
        for user, path, original, available in (("player-a", path_a, a, 2), ("player-b", path_b, b, 1)):
            current = self.client.call("GET", path, user=user)
            self.assertEqual(current.status, 200)
            for field in ("id", "owner", "units", "key", "state"):
                self.assertEqual(current.body[field], original.body[field])
            quota = self.client.call("GET", "/quota", user=user)
            self.assertEqual(quota.status, 200)
            self.assertEqual(quota.body, {"available": available, "consumed": 0})
        released = self.client.call("POST", path_a + "/release", user="player-a")
        self.assertEqual(released.status, 200)
        self.assertEqual(released.body["id"], a.body["id"])
        self.assertEqual(released.body["state"], "released")
        for user, path, hold_id, state, available in (("player-a", path_a, a.body["id"], "released", 4), ("player-b", path_b, b.body["id"], "active", 1)):
            current = self.client.call("GET", path, user=user)
            self.assertEqual(current.status, 200)
            self.assertEqual(current.body["id"], hold_id)
            self.assertEqual(current.body["state"], state)
            quota = self.client.call("GET", "/quota", user=user)
            self.assertEqual(quota.status, 200)
            self.assertEqual(quota.body, {"available": available, "consumed": 0})

    def test_hold_access_and_missing_id(self):
        created = self.client.call("POST", "/holds", {"units": 1, "key": "OwnerCheck1"})
        self.assertEqual(created.status, 201)
        self.assertIn("id", created.body)
        for field, value in (("owner", "player-a"), ("units", 1), ("key", "OwnerCheck1"), ("state", "active")):
            self.assertEqual(created.body[field], value)
        path = "/holds/" + str(created.body["id"])
        for user, available in (("player-a", 3), ("player-b", 4)):
            quota = self.client.call("GET", "/quota", user=user)
            self.assertEqual(quota.status, 200)
            self.assertEqual(quota.body, {"available": available, "consumed": 0})
        owned = self.client.call("GET", path)
        self.assertEqual(owned.status, 200)
        for field in ("id", "owner", "units", "key", "state"):
            self.assertEqual(owned.body[field], created.body[field])
        for method, suffix in (("GET", ""), ("POST", "/release"), ("POST", "/consume")):
            self.assertEqual(self.client.call(method, path + suffix, user="player-b").status, 403)
        missing_path = "/holds/never-created-S09"
        self.assertEqual(self.client.call("GET", missing_path).status, 404)
        for user in ("player-a", "player-b"):
            for method, suffix in (("GET", ""), ("POST", "/release"), ("POST", "/consume")):
                self.assertEqual(self.client.call(method, missing_path + suffix, user=user).status, 404)
        current = self.client.call("GET", path)
        self.assertEqual(current.status, 200)
        for field in ("id", "owner", "units", "key", "state"):
            self.assertEqual(current.body[field], created.body[field])
        for user, available in (("player-a", 3), ("player-b", 4)):
            quota = self.client.call("GET", "/quota", user=user)
            self.assertEqual(quota.status, 200)
            self.assertEqual(quota.body, {"available": available, "consumed": 0})

    def test_concurrent_same_key_creates_one_hold(self):
        request = {"method": "POST", "path": "/holds", "body": {"units": 1, "key": "SameKey10"}, "user": "player-a"}
        responses = self.client.parallel([request.copy() for _ in range(4)])
        self.assertEqual(sorted(response.status for response in responses), [200, 200, 200, 201])
        ids = []
        for response in responses:
            self.assertIn("id", response.body)
            ids.append(response.body["id"])
            for field, value in (("owner", "player-a"), ("units", 1), ("key", "SameKey10"), ("state", "active")):
                self.assertEqual(response.body[field], value)
        self.assertTrue(all(hold_id == ids[0] for hold_id in ids))
        current = self.client.call("GET", "/holds/" + str(ids[0]))
        self.assertEqual(current.status, 200)
        for field in ("id", "owner", "units", "key", "state"):
            self.assertEqual(current.body[field], responses[0].body[field])
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 3, "consumed": 0})
        self.assertEqual(quota.body["available"] + current.body["units"] + quota.body["consumed"], 4)

    def test_concurrent_capacity_rejects_without_saving_key(self):
        keys = ("CapA11", "CapB11")
        requests = [{"method": "POST", "path": "/holds", "body": {"units": 3, "key": key}, "user": "player-a"} for key in keys]
        responses = self.client.parallel(requests)
        self.assertEqual(sorted(response.status for response in responses), [201, 409])
        winner = 0 if responses[0].status == 201 else 1
        loser = 1 - winner
        created = responses[winner]
        self.assertIn("id", created.body)
        for field, value in (("owner", "player-a"), ("units", 3), ("key", keys[winner]), ("state", "active")):
            self.assertEqual(created.body[field], value)
        current = self.client.call("GET", "/holds/" + str(created.body["id"]))
        self.assertEqual(current.status, 200)
        for field in ("id", "owner", "units", "key", "state"):
            self.assertEqual(current.body[field], created.body[field])
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 1, "consumed": 0})
        self.assertEqual(quota.body["available"] + created.body["units"] + quota.body["consumed"], 4)
        retry = self.client.call("POST", "/holds", {"units": 1, "key": keys[loser]})
        self.assertEqual(retry.status, 201)
        self.assertIn("id", retry.body)
        self.assertNotEqual(retry.body["id"], created.body["id"])
        for field, value in (("owner", "player-a"), ("units", 1), ("key", keys[loser]), ("state", "active")):
            self.assertEqual(retry.body[field], value)
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 0, "consumed": 0})
        self.assertEqual(quota.body["available"] + created.body["units"] + retry.body["units"] + quota.body["consumed"], 4)

    def test_concurrent_release_restores_quota_once(self):
        created = self.client.call("POST", "/holds", {"units": 3, "key": "Release12"})
        self.assertEqual(created.status, 201)
        self.assertIn("id", created.body)
        for field, value in (("owner", "player-a"), ("units", 3), ("key", "Release12"), ("state", "active")):
            self.assertEqual(created.body[field], value)
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 1, "consumed": 0})
        path = "/holds/" + str(created.body["id"])
        request = {"method": "POST", "path": path + "/release", "user": "player-a"}
        responses = self.client.parallel([request.copy() for _ in range(4)])
        for response in responses:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.body["id"], created.body["id"])
            self.assertEqual(response.body["state"], "released")
        current = self.client.call("GET", path)
        self.assertEqual(current.status, 200)
        self.assertEqual(current.body["id"], created.body["id"])
        self.assertEqual(current.body["state"], "released")
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 4, "consumed": 0})
        self.assertEqual(quota.body["available"] + quota.body["consumed"], 4)

    def test_concurrent_consume_counts_once(self):
        created = self.client.call("POST", "/holds", {"units": 3, "key": "ConsumeOnce"})
        self.assertEqual(created.status, 201)
        self.assertIn("id", created.body)
        for field, value in (("owner", "player-a"), ("units", 3), ("key", "ConsumeOnce"), ("state", "active")):
            self.assertEqual(created.body[field], value)
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 1, "consumed": 0})
        path = "/holds/" + str(created.body["id"])
        request = {"method": "POST", "path": path + "/consume", "user": "player-a"}
        responses = self.client.parallel([request.copy() for _ in range(4)])
        for response in responses:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.body["id"], created.body["id"])
            self.assertEqual(response.body["state"], "consumed")
        current = self.client.call("GET", path)
        self.assertEqual(current.status, 200)
        for field in ("id", "owner", "units", "key"):
            self.assertEqual(current.body[field], created.body[field])
        self.assertEqual(current.body["state"], "consumed")
        quota = self.client.call("GET", "/quota")
        self.assertEqual(quota.status, 200)
        self.assertEqual(quota.body, {"available": 1, "consumed": 3})
        self.assertEqual(quota.body["available"] + quota.body["consumed"], 4)
