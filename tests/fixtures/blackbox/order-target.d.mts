import type { Server } from 'node:http';

export type OrderDefect =
  | 'cancel_replay_stock'
  | 'declined_payment_commit'
  | 'payment_replay_debit'
  | 'idempotency_identity_scope'
  | 'rejected_cancel_mutation'
  | 'concurrent_payment_debit';
export const orderDefects: OrderDefect[];
export function createOrderTarget(defect?: OrderDefect | null): Server;
