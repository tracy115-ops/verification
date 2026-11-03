import unittest
import framework


class OrderInventoryTests(framework.BlackBoxCase):
    def test_reserve_full_capacity(self):
        inventory = self.client.call('GET', '/inventory')
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 4})
        created = self.client.call('POST', '/orders', {'quantity': 4, 'requestId': 'full'})
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        expected = {'id': order_id, 'owner': 'user-a', 'quantity': 4, 'state': 'reserved'}
        self.assertEqual(created.body, expected)
        fetched = self.client.call('GET', f'/orders/{order_id}')
        self.assertEqual(fetched.status, 200)
        self.assertEqual(fetched.body, expected)
        inventory = self.client.call('GET', '/inventory', user='user-b')
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 0})
        for user in ['user-a', 'user-b']:
            wallet = self.client.call('GET', '/wallet', user=user)
            self.assertEqual(wallet.status, 200)
            self.assertEqual(wallet.body, {'balance': 100, 'charges': 0})

    def test_reserved_replay_and_payload_conflict(self):
        created = self.client.call('POST', '/orders', {'quantity': 2, 'requestId': 'replay'})
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        self.assertEqual(created.body['state'], 'reserved')
        before = self.client.call('GET', '/inventory')
        self.assertEqual(before.status, 200)
        self.assertEqual(before.body, {'available': 2})
        replay = self.client.call('POST', '/orders', {'quantity': 2, 'requestId': 'replay'})
        self.assertEqual(replay.status, 200)
        self.assertEqual(replay.body, created.body)
        conflict = self.client.call('POST', '/orders', {'quantity': 3, 'requestId': 'replay'})
        self.assertEqual(conflict.status, 409)
        fetched = self.client.call('GET', f'/orders/{order_id}')
        self.assertEqual(fetched.status, 200)
        self.assertEqual(fetched.body, created.body)
        after = self.client.call('GET', '/inventory')
        self.assertEqual(after.status, 200)
        self.assertEqual(after.body, before.body)
        wallet = self.client.call('GET', '/wallet')
        self.assertEqual(wallet.status, 200)
        self.assertEqual(wallet.body, {'balance': 100, 'charges': 0})

    def test_same_key_is_independent_across_users(self):
        first = self.client.call('POST', '/orders', {'quantity': 1, 'requestId': 'shared'})
        self.assertEqual(first.status, 201)
        first_id = first.body['id']
        self.assertEqual(first.body, {'id': first_id, 'owner': 'user-a', 'quantity': 1, 'state': 'reserved'})
        second = self.client.call('POST', '/orders', {'quantity': 3, 'requestId': 'shared'}, user='user-b')
        self.assertEqual(second.status, 201)
        second_id = second.body['id']
        self.assertNotEqual(first_id, second_id)
        self.assertEqual(second.body, {'id': second_id, 'owner': 'user-b', 'quantity': 3, 'state': 'reserved'})
        for user, quantity, expected in [('user-a', 1, first.body), ('user-b', 3, second.body)]:
            replay = self.client.call('POST', '/orders', {'quantity': quantity, 'requestId': 'shared'}, user=user)
            self.assertEqual(replay.status, 200)
            self.assertEqual(replay.body, expected)
            inventory = self.client.call('GET', '/inventory', user=user)
            self.assertEqual(inventory.status, 200)
            self.assertEqual(inventory.body, {'available': 0})
            wallet = self.client.call('GET', '/wallet', user=user)
            self.assertEqual(wallet.status, 200)
            self.assertEqual(wallet.body, {'balance': 100, 'charges': 0})

    def test_foreign_query_preserves_order_and_resources(self):
        created = self.client.call('POST', '/orders', {'quantity': 2, 'requestId': 'private'}, user='user-b')
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        self.assertEqual(created.body['owner'], 'user-b')
        self.assertEqual(created.body['state'], 'reserved')
        denied = self.client.call('GET', f'/orders/{order_id}', user='user-a')
        self.assertEqual(denied.status, 403)
        fetched = self.client.call('GET', f'/orders/{order_id}', user='user-b')
        self.assertEqual(fetched.status, 200)
        self.assertEqual(fetched.body, created.body)
        inventory = self.client.call('GET', '/inventory')
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 2})
        for user in ['user-a', 'user-b']:
            wallet = self.client.call('GET', '/wallet', user=user)
            self.assertEqual(wallet.status, 200)
            self.assertEqual(wallet.body, {'balance': 100, 'charges': 0})

    def test_cancel_replay_releases_stock_once(self):
        created = self.client.call('POST', '/orders', {'quantity': 3, 'requestId': 'cancel'})
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        self.assertEqual(created.body['state'], 'reserved')
        inventory = self.client.call('GET', '/inventory')
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 1})
        for attempt in range(2):
            cancelled = self.client.call('POST', f'/orders/{order_id}/cancel', {})
            self.assertEqual(cancelled.status, 200)
            fetched = self.client.call('GET', f'/orders/{order_id}')
            self.assertEqual(fetched.status, 200)
            self.assertEqual(fetched.body, {'id': order_id, 'owner': 'user-a', 'quantity': 3, 'state': 'cancelled'})
            inventory = self.client.call('GET', '/inventory')
            self.assertEqual(inventory.status, 200)
            self.assertEqual(inventory.body, {'available': 4})
            wallet = self.client.call('GET', '/wallet')
            self.assertEqual(wallet.status, 200)
            self.assertEqual(wallet.body, {'balance': 100, 'charges': 0})

    def test_paid_cancel_rejection_is_atomic(self):
        created = self.client.call('POST', '/orders', {'quantity': 2, 'requestId': 'paid-cancel'})
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        self.assertEqual(created.body['state'], 'reserved')
        paid = self.client.call('POST', f'/orders/{order_id}/pay', {'paymentToken': 'ok'})
        self.assertEqual(paid.status, 200)
        self.assertEqual(paid.body, {'id': order_id, 'owner': 'user-a', 'quantity': 2, 'state': 'paid'})
        before_inventory = self.client.call('GET', '/inventory')
        before_wallet = self.client.call('GET', '/wallet')
        self.assertEqual(before_inventory.status, 200)
        self.assertEqual(before_inventory.body, {'available': 2})
        self.assertEqual(before_wallet.status, 200)
        self.assertEqual(before_wallet.body, {'balance': 80, 'charges': 1})
        rejected = self.client.call('POST', f'/orders/{order_id}/cancel', {})
        self.assertEqual(rejected.status, 409)
        fetched = self.client.call('GET', f'/orders/{order_id}')
        inventory = self.client.call('GET', '/inventory')
        wallet = self.client.call('GET', '/wallet')
        self.assertEqual(fetched.status, 200)
        self.assertEqual(fetched.body, paid.body)
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, before_inventory.body)
        self.assertEqual(wallet.status, 200)
        self.assertEqual(wallet.body, before_wallet.body)

    def test_declined_payment_preserves_state_then_recovers(self):
        created = self.client.call('POST', '/orders', {'quantity': 3, 'requestId': 'recover'})
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        self.assertEqual(created.body['state'], 'reserved')
        for attempt in range(2):
            declined = self.client.call('POST', f'/orders/{order_id}/pay', {'paymentToken': 'declined'})
            self.assertEqual(declined.status, 402)
            fetched = self.client.call('GET', f'/orders/{order_id}')
            inventory = self.client.call('GET', '/inventory')
            wallet = self.client.call('GET', '/wallet')
            self.assertEqual(fetched.status, 200)
            self.assertEqual(fetched.body, created.body)
            self.assertEqual(inventory.status, 200)
            self.assertEqual(inventory.body, {'available': 1})
            self.assertEqual(wallet.status, 200)
            self.assertEqual(wallet.body, {'balance': 100, 'charges': 0})
        paid = self.client.call('POST', f'/orders/{order_id}/pay', {'paymentToken': 'ok'})
        self.assertEqual(paid.status, 200)
        self.assertEqual(paid.body, {'id': order_id, 'owner': 'user-a', 'quantity': 3, 'state': 'paid'})
        fetched = self.client.call('GET', f'/orders/{order_id}')
        inventory = self.client.call('GET', '/inventory')
        wallet = self.client.call('GET', '/wallet')
        self.assertEqual(fetched.status, 200)
        self.assertEqual(fetched.body, paid.body)
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 1})
        self.assertEqual(wallet.status, 200)
        self.assertEqual(wallet.body, {'balance': 70, 'charges': 1})

    def test_paid_payment_and_creation_replays(self):
        created = self.client.call('POST', '/orders', {'quantity': 1, 'requestId': 'paid-replay'})
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        self.assertEqual(created.body['state'], 'reserved')
        paid = self.client.call('POST', f'/orders/{order_id}/pay', {'paymentToken': 'ok'})
        self.assertEqual(paid.status, 200)
        self.assertEqual(paid.body, {'id': order_id, 'owner': 'user-a', 'quantity': 1, 'state': 'paid'})
        repeated = self.client.call('POST', f'/orders/{order_id}/pay', {'paymentToken': 'ok'})
        self.assertEqual(repeated.status, 200)
        self.assertEqual(repeated.body, paid.body)
        replay = self.client.call('POST', '/orders', {'quantity': 1, 'requestId': 'paid-replay'})
        self.assertEqual(replay.status, 200)
        self.assertEqual(replay.body['id'], order_id)
        self.assertEqual(replay.body['owner'], 'user-a')
        self.assertEqual(replay.body['quantity'], 1)
        conflict = self.client.call('POST', '/orders', {'quantity': 2, 'requestId': 'paid-replay'})
        self.assertEqual(conflict.status, 409)
        fetched = self.client.call('GET', f'/orders/{order_id}')
        inventory = self.client.call('GET', '/inventory')
        wallet = self.client.call('GET', '/wallet')
        self.assertEqual(fetched.status, 200)
        self.assertEqual(fetched.body, paid.body)
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 3})
        self.assertEqual(wallet.status, 200)
        self.assertEqual(wallet.body, {'balance': 90, 'charges': 1})

    def test_cancelled_payment_and_creation_replays(self):
        created = self.client.call('POST', '/orders', {'quantity': 2, 'requestId': 'cancelled-replay'})
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        self.assertEqual(created.body['state'], 'reserved')
        cancelled = self.client.call('POST', f'/orders/{order_id}/cancel', {})
        self.assertEqual(cancelled.status, 200)
        intermediate = self.client.call('GET', f'/orders/{order_id}')
        self.assertEqual(intermediate.status, 200)
        self.assertEqual(intermediate.body, {'id': order_id, 'owner': 'user-a', 'quantity': 2, 'state': 'cancelled'})
        replay = self.client.call('POST', '/orders', {'quantity': 2, 'requestId': 'cancelled-replay'})
        self.assertEqual(replay.status, 200)
        self.assertEqual(replay.body['id'], order_id)
        self.assertEqual(replay.body['owner'], 'user-a')
        self.assertEqual(replay.body['quantity'], 2)
        conflict = self.client.call('POST', '/orders', {'quantity': 1, 'requestId': 'cancelled-replay'})
        self.assertEqual(conflict.status, 409)
        rejected = self.client.call('POST', f'/orders/{order_id}/pay', {'paymentToken': 'ok'})
        self.assertEqual(rejected.status, 409)
        fetched = self.client.call('GET', f'/orders/{order_id}')
        inventory = self.client.call('GET', '/inventory')
        wallet = self.client.call('GET', '/wallet')
        self.assertEqual(fetched.status, 200)
        self.assertEqual(fetched.body, intermediate.body)
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 4})
        self.assertEqual(wallet.status, 200)
        self.assertEqual(wallet.body, {'balance': 100, 'charges': 0})

    def test_foreign_mutations_preserve_reserved_and_paid_states(self):
        created = self.client.call('POST', '/orders', {'quantity': 2, 'requestId': 'foreign'})
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        self.assertEqual(created.body['state'], 'reserved')
        expected = created.body
        for state in ['reserved', 'paid']:
            if state == 'paid':
                paid = self.client.call('POST', f'/orders/{order_id}/pay', {'paymentToken': 'ok'})
                self.assertEqual(paid.status, 200)
                expected = {'id': order_id, 'owner': 'user-a', 'quantity': 2, 'state': 'paid'}
                self.assertEqual(paid.body, expected)
            for action, body in [('pay', {'paymentToken': 'ok'}), ('cancel', {})]:
                denied = self.client.call('POST', f'/orders/{order_id}/{action}', body, user='user-b')
                self.assertEqual(denied.status, 403)
                fetched = self.client.call('GET', f'/orders/{order_id}')
                inventory = self.client.call('GET', '/inventory')
                self.assertEqual(fetched.status, 200)
                self.assertEqual(fetched.body, expected)
                self.assertEqual(inventory.status, 200)
                self.assertEqual(inventory.body, {'available': 2})
                for user in ['user-a', 'user-b']:
                    wallet = self.client.call('GET', '/wallet', user=user)
                    self.assertEqual(wallet.status, 200)
                    expected_wallet = {'balance': 80, 'charges': 1} if state == 'paid' and user == 'user-a' else {'balance': 100, 'charges': 0}
                    self.assertEqual(wallet.body, expected_wallet)

    def test_parallel_payments_charge_once(self):
        created = self.client.call('POST', '/orders', {'quantity': 4, 'requestId': 'parallel'})
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        self.assertEqual(created.body['state'], 'reserved')
        before_inventory = self.client.call('GET', '/inventory')
        before_wallet = self.client.call('GET', '/wallet')
        self.assertEqual(before_inventory.status, 200)
        self.assertEqual(before_inventory.body, {'available': 0})
        self.assertEqual(before_wallet.status, 200)
        self.assertEqual(before_wallet.body, {'balance': 100, 'charges': 0})
        responses = self.client.parallel([
            {'method': 'POST', 'path': f'/orders/{order_id}/pay', 'body': {'paymentToken': 'ok'}, 'user': 'user-a'},
            {'method': 'POST', 'path': f'/orders/{order_id}/pay', 'body': {'paymentToken': 'ok'}, 'user': 'user-a'}
        ])
        self.assertEqual(len(responses), 2)
        expected = {'id': order_id, 'owner': 'user-a', 'quantity': 4, 'state': 'paid'}
        for response in responses:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.body, expected)
        fetched = self.client.call('GET', f'/orders/{order_id}')
        inventory = self.client.call('GET', '/inventory')
        wallet = self.client.call('GET', '/wallet')
        self.assertEqual(fetched.status, 200)
        self.assertEqual(fetched.body, expected)
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, before_inventory.body)
        self.assertEqual(wallet.status, 200)
        self.assertEqual(wallet.body, {'balance': before_wallet.body['balance'] - 40, 'charges': before_wallet.body['charges'] + 1})

    def test_invalid_creation_preserves_existing_state(self):
        created = self.client.call('POST', '/orders', {'quantity': 1, 'requestId': 'valid'})
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        self.assertEqual(created.body['state'], 'reserved')
        invalid_bodies = [
            {'quantity': 0, 'requestId': 'zero'},
            {'quantity': 5, 'requestId': 'large'},
            {'quantity': 1.5, 'requestId': 'fraction'},
            {'quantity': '1', 'requestId': 'text'},
            {'quantity': 1, 'requestId': ''},
            {'quantity': 1, 'requestId': None},
            {'quantity': 1, 'requestId': 7},
            {'requestId': 'missing-quantity'},
            {'quantity': 1}
        ]
        for body in invalid_bodies:
            rejected = self.client.call('POST', '/orders', body)
            self.assertEqual(rejected.status, 400)
            fetched = self.client.call('GET', f'/orders/{order_id}')
            inventory = self.client.call('GET', '/inventory')
            self.assertEqual(fetched.status, 200)
            self.assertEqual(fetched.body, created.body)
            self.assertEqual(inventory.status, 200)
            self.assertEqual(inventory.body, {'available': 3})
            for user in ['user-a', 'user-b']:
                wallet = self.client.call('GET', '/wallet', user=user)
                self.assertEqual(wallet.status, 200)
                self.assertEqual(wallet.body, {'balance': 100, 'charges': 0})

    def test_insufficient_inventory_then_release_and_reserve(self):
        created = self.client.call('POST', '/orders', {'quantity': 3, 'requestId': 'occupy'})
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        self.assertEqual(created.body['state'], 'reserved')
        rejected = self.client.call('POST', '/orders', {'quantity': 2, 'requestId': 'insufficient'}, user='user-b')
        self.assertEqual(rejected.status, 409)
        fetched = self.client.call('GET', f'/orders/{order_id}')
        inventory = self.client.call('GET', '/inventory')
        self.assertEqual(fetched.status, 200)
        self.assertEqual(fetched.body, created.body)
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 1})
        for user in ['user-a', 'user-b']:
            wallet = self.client.call('GET', '/wallet', user=user)
            self.assertEqual(wallet.status, 200)
            self.assertEqual(wallet.body, {'balance': 100, 'charges': 0})
        cancelled = self.client.call('POST', f'/orders/{order_id}/cancel', {})
        self.assertEqual(cancelled.status, 200)
        inventory = self.client.call('GET', '/inventory')
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 4})
        replacement = self.client.call('POST', '/orders', {'quantity': 4, 'requestId': 'replacement'}, user='user-b')
        self.assertEqual(replacement.status, 201)
        replacement_id = replacement.body['id']
        self.assertNotEqual(replacement_id, order_id)
        self.assertEqual(replacement.body, {'id': replacement_id, 'owner': 'user-b', 'quantity': 4, 'state': 'reserved'})
        fetched = self.client.call('GET', f'/orders/{order_id}')
        inventory = self.client.call('GET', '/inventory')
        self.assertEqual(fetched.status, 200)
        self.assertEqual(fetched.body, {'id': order_id, 'owner': 'user-a', 'quantity': 3, 'state': 'cancelled'})
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 0})
        for user in ['user-a', 'user-b']:
            wallet = self.client.call('GET', '/wallet', user=user)
            self.assertEqual(wallet.status, 200)
            self.assertEqual(wallet.body, {'balance': 100, 'charges': 0})

    def test_missing_identity_is_rejected_without_effects(self):
        created = self.client.call('POST', '/orders', {'quantity': 2, 'requestId': 'authenticated'})
        self.assertEqual(created.status, 201)
        order_id = created.body['id']
        self.assertEqual(created.body['state'], 'reserved')
        requests = [
            ('GET', '/inventory', None),
            ('GET', '/wallet', None),
            ('GET', f'/orders/{order_id}', None),
            ('POST', '/orders', {'quantity': 1, 'requestId': 'anonymous'}),
            ('POST', f'/orders/{order_id}/pay', {'paymentToken': 'ok'}),
            ('POST', f'/orders/{order_id}/cancel', {})
        ]
        for method, path, body in requests:
            rejected = self.client.call(method, path, body, user=None)
            self.assertEqual(rejected.status, 401)
            fetched = self.client.call('GET', f'/orders/{order_id}')
            inventory = self.client.call('GET', '/inventory')
            self.assertEqual(fetched.status, 200)
            self.assertEqual(fetched.body, created.body)
            self.assertEqual(inventory.status, 200)
            self.assertEqual(inventory.body, {'available': 2})
            for user in ['user-a', 'user-b']:
                wallet = self.client.call('GET', '/wallet', user=user)
                self.assertEqual(wallet.status, 200)
                self.assertEqual(wallet.body, {'balance': 100, 'charges': 0})

    def test_multiple_orders_keep_stock_and_wallets_consistent(self):
        first = self.client.call('POST', '/orders', {'quantity': 2, 'requestId': 'first'})
        second = self.client.call('POST', '/orders', {'quantity': 2, 'requestId': 'second'}, user='user-b')
        self.assertEqual(first.status, 201)
        self.assertEqual(second.status, 201)
        first_id = first.body['id']
        second_id = second.body['id']
        self.assertNotEqual(first_id, second_id)
        self.assertEqual(first.body['state'], 'reserved')
        self.assertEqual(second.body['state'], 'reserved')
        inventory = self.client.call('GET', '/inventory')
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 0})
        paid = self.client.call('POST', f'/orders/{first_id}/pay', {'paymentToken': 'ok'})
        self.assertEqual(paid.status, 200)
        self.assertEqual(paid.body, {'id': first_id, 'owner': 'user-a', 'quantity': 2, 'state': 'paid'})
        cancelled = self.client.call('POST', f'/orders/{second_id}/cancel', {}, user='user-b')
        self.assertEqual(cancelled.status, 200)
        inventory = self.client.call('GET', '/inventory')
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 2})
        third = self.client.call('POST', '/orders', {'quantity': 1, 'requestId': 'third'})
        self.assertEqual(third.status, 201)
        third_id = third.body['id']
        self.assertNotIn(third_id, [first_id, second_id])
        self.assertEqual(third.body['state'], 'reserved')
        third_paid = self.client.call('POST', f'/orders/{third_id}/pay', {'paymentToken': 'ok'})
        self.assertEqual(third_paid.status, 200)
        self.assertEqual(third_paid.body, {'id': third_id, 'owner': 'user-a', 'quantity': 1, 'state': 'paid'})
        for order_id, user, quantity, state in [(first_id, 'user-a', 2, 'paid'), (second_id, 'user-b', 2, 'cancelled'), (third_id, 'user-a', 1, 'paid')]:
            fetched = self.client.call('GET', f'/orders/{order_id}', user=user)
            self.assertEqual(fetched.status, 200)
            self.assertEqual(fetched.body, {'id': order_id, 'owner': user, 'quantity': quantity, 'state': state})
        inventory = self.client.call('GET', '/inventory')
        self.assertEqual(inventory.status, 200)
        self.assertEqual(inventory.body, {'available': 1})
        first_wallet = self.client.call('GET', '/wallet')
        second_wallet = self.client.call('GET', '/wallet', user='user-b')
        self.assertEqual(first_wallet.status, 200)
        self.assertEqual(first_wallet.body, {'balance': 70, 'charges': 2})
        self.assertEqual(second_wallet.status, 200)
        self.assertEqual(second_wallet.body, {'balance': 100, 'charges': 0})
