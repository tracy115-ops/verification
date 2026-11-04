import unittest
import framework

# Generated tests only; no test execution has occurred.
# Scope excludes rejection, cancellation, concurrency, other identities,
# invalid parameters, and creation-request idempotency.

class OrderPaymentTests(framework.BlackBoxCase):
    def test_c01_first_payment_updates_order_wallet_and_inventory(self):
        initial_wallet = self.client.call('GET', '/wallet', user='user-a')
        initial_inventory = self.client.call('GET', '/inventory', user='user-a')
        for path, response, expected in [
            ('/wallet', initial_wallet, {'balance': 100, 'charges': 0}),
            ('/inventory', initial_inventory, {'available': 4}),
        ]:
            evidence = ('GET', path, response.status, response.body)
            self.assertEqual(response.status, 200, evidence)
            for field, value in expected.items():
                self.assertIs(type(response.body.get(field)), int, evidence)
                self.assertEqual(response.body.get(field), value, evidence)

        create_body = {'quantity': 2, 'requestId': 'C01-create'}
        created = self.client.call('POST', '/orders', body=create_body, user='user-a')
        evidence = ('POST', '/orders', create_body, created.status, created.body)
        self.assertEqual(created.status, 201, evidence)
        self.assertIsInstance(created.body.get('id'), str, evidence)
        self.assertTrue(created.body.get('id'), evidence)
        order_id = created.body['id']
        for field, value in {'owner': 'user-a', 'quantity': 2, 'state': 'reserved'}.items():
            self.assertEqual(created.body.get(field), value, evidence)
        order_path = '/orders/' + order_id

        reserved_wallet = self.client.call('GET', '/wallet', user='user-a')
        reserved_inventory = self.client.call('GET', '/inventory', user='user-a')
        reserved_order = self.client.call('GET', order_path, user='user-a')
        for path, response, expected in [
            ('/wallet', reserved_wallet, {'balance': 100, 'charges': 0}),
            ('/inventory', reserved_inventory, {'available': 2}),
        ]:
            evidence = ('GET', path, response.status, response.body)
            self.assertEqual(response.status, 200, evidence)
            for field, value in expected.items():
                self.assertIs(type(response.body.get(field)), int, evidence)
                self.assertEqual(response.body.get(field), value, evidence)
        evidence = ('GET', order_path, reserved_order.status, reserved_order.body)
        self.assertEqual(reserved_order.status, 200, evidence)
        for field, value in {'id': order_id, 'owner': 'user-a', 'quantity': 2, 'state': 'reserved'}.items():
            self.assertEqual(reserved_order.body.get(field), value, evidence)
        evidence = ('creation snapshots', initial_wallet, reserved_wallet, initial_inventory, reserved_inventory)
        self.assertEqual(reserved_inventory.body['available'], initial_inventory.body['available'] - 2, evidence)
        self.assertEqual(reserved_wallet.body['balance'], initial_wallet.body['balance'], evidence)
        self.assertEqual(reserved_wallet.body['charges'], initial_wallet.body['charges'], evidence)

        pay_path = order_path + '/pay'
        pay_body = {'paymentToken': 'ok'}
        paid = self.client.call('POST', pay_path, body=pay_body, user='user-a')
        evidence = ('POST', pay_path, pay_body, paid.status, paid.body)
        self.assertEqual(paid.status, 200, evidence)
        for field, value in {'id': order_id, 'owner': 'user-a', 'quantity': 2, 'state': 'paid'}.items():
            self.assertEqual(paid.body.get(field), value, evidence)

        paid_wallet = self.client.call('GET', '/wallet', user='user-a')
        paid_inventory = self.client.call('GET', '/inventory', user='user-a')
        paid_order = self.client.call('GET', order_path, user='user-a')
        for path, response, expected in [
            ('/wallet', paid_wallet, {'balance': 80, 'charges': 1}),
            ('/inventory', paid_inventory, {'available': 2}),
        ]:
            evidence = ('GET', path, response.status, response.body)
            self.assertEqual(response.status, 200, evidence)
            for field, value in expected.items():
                self.assertIs(type(response.body.get(field)), int, evidence)
                self.assertEqual(response.body.get(field), value, evidence)
        evidence = ('GET', order_path, paid_order.status, paid_order.body)
        self.assertEqual(paid_order.status, 200, evidence)
        for field, value in {'id': order_id, 'owner': 'user-a', 'quantity': 2, 'state': 'paid'}.items():
            self.assertEqual(paid_order.body.get(field), value, evidence)
        evidence = ('payment snapshots', reserved_wallet, paid_wallet, reserved_inventory, paid_inventory)
        self.assertEqual(paid_wallet.body['balance'], reserved_wallet.body['balance'] - 20, evidence)
        self.assertEqual(paid_wallet.body['charges'], reserved_wallet.body['charges'] + 1, evidence)
        self.assertEqual(paid_inventory.body['available'], reserved_inventory.body['available'], evidence)

    def test_c02_sequential_payment_replay_preserves_paid_order_and_resources(self):
        initial_wallet = self.client.call('GET', '/wallet', user='user-a')
        initial_inventory = self.client.call('GET', '/inventory', user='user-a')
        for path, response, expected in [
            ('/wallet', initial_wallet, {'balance': 100, 'charges': 0}),
            ('/inventory', initial_inventory, {'available': 4}),
        ]:
            evidence = ('GET', path, response.status, response.body)
            self.assertEqual(response.status, 200, evidence)
            for field, value in expected.items():
                self.assertIs(type(response.body.get(field)), int, evidence)
                self.assertEqual(response.body.get(field), value, evidence)

        create_body = {'quantity': 2, 'requestId': 'C02-create'}
        created = self.client.call('POST', '/orders', body=create_body, user='user-a')
        evidence = ('POST', '/orders', create_body, created.status, created.body)
        self.assertEqual(created.status, 201, evidence)
        self.assertIsInstance(created.body.get('id'), str, evidence)
        self.assertTrue(created.body.get('id'), evidence)
        order_id = created.body['id']
        for field, value in {'owner': 'user-a', 'quantity': 2, 'state': 'reserved'}.items():
            self.assertEqual(created.body.get(field), value, evidence)
        order_path = '/orders/' + order_id

        reserved_wallet = self.client.call('GET', '/wallet', user='user-a')
        reserved_inventory = self.client.call('GET', '/inventory', user='user-a')
        reserved_order = self.client.call('GET', order_path, user='user-a')
        for path, response, expected in [
            ('/wallet', reserved_wallet, {'balance': 100, 'charges': 0}),
            ('/inventory', reserved_inventory, {'available': 2}),
        ]:
            evidence = ('GET', path, response.status, response.body)
            self.assertEqual(response.status, 200, evidence)
            for field, value in expected.items():
                self.assertIs(type(response.body.get(field)), int, evidence)
                self.assertEqual(response.body.get(field), value, evidence)
        evidence = ('GET', order_path, reserved_order.status, reserved_order.body)
        self.assertEqual(reserved_order.status, 200, evidence)
        for field, value in {'id': order_id, 'owner': 'user-a', 'quantity': 2, 'state': 'reserved'}.items():
            self.assertEqual(reserved_order.body.get(field), value, evidence)

        pay_path = order_path + '/pay'
        pay_body = {'paymentToken': 'ok'}
        first_paid = self.client.call('POST', pay_path, body=pay_body, user='user-a')
        evidence = ('POST', pay_path, pay_body, first_paid.status, first_paid.body)
        self.assertEqual(first_paid.status, 200, evidence)
        for field, value in {'id': order_id, 'owner': 'user-a', 'quantity': 2, 'state': 'paid'}.items():
            self.assertEqual(first_paid.body.get(field), value, evidence)

        first_wallet = self.client.call('GET', '/wallet', user='user-a')
        first_inventory = self.client.call('GET', '/inventory', user='user-a')
        first_order = self.client.call('GET', order_path, user='user-a')
        for path, response, expected in [
            ('/wallet', first_wallet, {'balance': 80, 'charges': 1}),
            ('/inventory', first_inventory, {'available': 2}),
        ]:
            evidence = ('GET', path, response.status, response.body)
            self.assertEqual(response.status, 200, evidence)
            for field, value in expected.items():
                self.assertIs(type(response.body.get(field)), int, evidence)
                self.assertEqual(response.body.get(field), value, evidence)
        evidence = ('GET', order_path, first_order.status, first_order.body)
        self.assertEqual(first_order.status, 200, evidence)
        for field, value in {'id': order_id, 'owner': 'user-a', 'quantity': 2, 'state': 'paid'}.items():
            self.assertEqual(first_order.body.get(field), value, evidence)

        replayed = self.client.call('POST', pay_path, body=pay_body, user='user-a')
        evidence = ('POST replay', pay_path, pay_body, replayed.status, replayed.body)
        self.assertEqual(replayed.status, 200, evidence)
        for field, value in {'id': order_id, 'owner': 'user-a', 'quantity': 2, 'state': 'paid'}.items():
            self.assertEqual(replayed.body.get(field), value, evidence)

        replay_wallet = self.client.call('GET', '/wallet', user='user-a')
        replay_inventory = self.client.call('GET', '/inventory', user='user-a')
        replay_order = self.client.call('GET', order_path, user='user-a')
        for path, response, previous, expected in [
            ('/wallet', replay_wallet, first_wallet, {'balance': 80, 'charges': 1}),
            ('/inventory', replay_inventory, first_inventory, {'available': 2}),
        ]:
            evidence = ('GET after replay', path, response.status, response.body, 'before replay', previous.status, previous.body)
            self.assertEqual(response.status, 200, evidence)
            for field, value in expected.items():
                self.assertIs(type(response.body.get(field)), int, evidence)
                self.assertEqual(response.body.get(field), value, evidence)
                self.assertEqual(response.body.get(field), previous.body[field], evidence)
        evidence = ('GET after replay', order_path, replay_order.status, replay_order.body, 'before replay', first_order.status, first_order.body)
        self.assertEqual(replay_order.status, 200, evidence)
        for field, value in {'id': order_id, 'owner': 'user-a', 'quantity': 2, 'state': 'paid'}.items():
            self.assertEqual(replay_order.body.get(field), value, evidence)
            self.assertEqual(replay_order.body.get(field), first_order.body[field], evidence)
