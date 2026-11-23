'''Black-box journey test for case-decline-then-recover-journey.

Approved journey (journey-decline-then-recover-single-order): create order
(201, reserved) -> pay declined (402, stays reserved) -> read back after
decline (200, reserved) -> pay the SAME order with ok (200, paid) -> final
read back (200, same id, paid).

Audit scope notes (not questions): only this single journey is approved for
this round, with quantity=1 and the fixed framework identity user-a. Other
behaviors are undefined by the source spec and intentionally not asserted:
no concurrency, replay, cancellation, balance or inventory checks, no other
identities, no invalid inputs.
'''

import unittest

from framework import BlackBoxCase


class TestDeclineThenRecoverJourney(BlackBoxCase):
    def test_declined_payment_then_recover_same_order_journey(self):
        # Step 1: create order, expect 201 and JSON with reserved state.
        created = self.client.call(
            'POST', '/orders', {'quantity': 1, 'requestId': 'journey'}
        )
        self.assertEqual(created.status, 201)
        self.assertIn('id', created.body)
        self.assertIn('owner', created.body)
        self.assertIn('quantity', created.body)
        self.assertIn('state', created.body)
        self.assertEqual(created.body['state'], 'reserved')
        order_id = created.body['id']

        # Step 2: pay the saved order with declined token, expect 402.
        declined = self.client.call(
            'POST', '/orders/%s/pay' % order_id, {'paymentToken': 'declined'}
        )
        self.assertEqual(declined.status, 402)

        # Step 3: read back after decline, expect 200 and state reserved.
        after_decline = self.client.call('GET', '/orders/%s' % order_id)
        self.assertEqual(after_decline.status, 200)
        self.assertIn('state', after_decline.body)
        self.assertEqual(after_decline.body['state'], 'reserved')

        # Step 4: pay the SAME order id with ok token, expect 200 and paid.
        recovered = self.client.call(
            'POST', '/orders/%s/pay' % order_id, {'paymentToken': 'ok'}
        )
        self.assertEqual(recovered.status, 200)
        self.assertIn('state', recovered.body)
        self.assertEqual(recovered.body['state'], 'paid')

        # Step 5: final read back, expect 200, same id, state paid.
        final = self.client.call('GET', '/orders/%s' % order_id)
        self.assertEqual(final.status, 200)
        self.assertEqual(final.body['id'], order_id)
        self.assertEqual(final.body['state'], 'paid')
