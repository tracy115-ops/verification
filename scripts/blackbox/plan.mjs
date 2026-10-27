const post = (path, body, headers = {}) => ({ method: 'POST', path, body, headers });
const account = (id) => ({ path: `/accounts/${id}`, headers: { Authorization: 'Bearer user-a' } });
const check = (id, title, requirementId, category, request, status, body) => ({
  id,
  title,
  requirementId,
  category,
  steps: [{ request, status, body }],
});
export const baseline = [
  check('N01', '有效金额', 'QUOTE', 'normal', post('/quote', { amount: 50 }), 200),
  check('N02', '本人账户', 'ACCESS', 'normal', account('user-a'), 200),
  check('N03', '成年会员折扣', 'DISCOUNT', 'normal', post('/discount', { age: 20, member: true }), 200, {
    discount: 10,
  }),
  check('N04', '有效用户名', 'NAME', 'normal', post('/users', { name: 'tester' }), 201),
  check(
    'N05',
    '支付正常返回',
    'PAYMENT',
    'normal',
    post('/payments', { paymentToken: 'valid-fixture' }),
    200,
    { status: 'paid' },
  ),
];
export const enhanced = [
  ...baseline,
  ...[
    [-1, 400],
    [0, 400],
    [1, 200],
    [2, 200],
    [99, 200],
    [100, 200],
    [101, 400],
  ].map(([amount, status], index) =>
    check(`B${index}`, `金额边界 ${amount}`, 'QUOTE', 'boundary', post('/quote', { amount }), status),
  ),
  ...[
    ['5', 400],
    [null, 400],
    [1.5, 400],
  ].map(([amount, status], index) =>
    check(
      `T${index}`,
      `金额类型 ${JSON.stringify(amount)}`,
      'QUOTE',
      'type',
      post('/quote', { amount }),
      status,
    ),
  ),
  check('A01', '无身份凭据', 'ACCESS', 'authentication', { path: '/accounts/user-a' }, 401),
  check('A02', '跨用户访问', 'ACCESS', 'authorization', account('user-b'), 403),
  {
    id: 'I01',
    title: '同一幂等键重放',
    requirementId: 'TRANSFER',
    category: 'idempotency',
    steps: [
      { request: post('/transfer', { amount: 10 }, { 'Idempotency-Key': 'fixture-key' }), status: 200 },
      { request: post('/transfer', { amount: 10 }, { 'Idempotency-Key': 'fixture-key' }), status: 200 },
      { request: account('idempotency'), status: 200, body: { balance: 90 } },
    ],
  },
  {
    id: 'C01',
    title: '并发扣款不透支',
    requirementId: 'WITHDRAW',
    category: 'concurrency',
    steps: [
      {
        parallel: [post('/withdraw', { amount: 80 }), post('/withdraw', { amount: 80 })],
        statuses: [200, 409],
      },
      { request: account('concurrent'), status: 200, body: { balance: 20 } },
    ],
  },
  check('S01', '已完成订单拒绝取消', 'ORDER', 'state_transition', post('/orders/completed/cancel', {}), 409, {
    status: 'completed',
  }),
  ...[
    [17, false, 0],
    [17, true, 0],
    [18, false, 0],
    [18, true, 10],
  ].map(([age, member, discount], index) =>
    check(
      `D${index}`,
      `折扣决策 age=${age} member=${member}`,
      'DISCOUNT',
      'decision_table',
      post('/discount', { age, member }),
      200,
      { discount },
    ),
  ),
  check('E01', '纯空白用户名', 'NAME', 'equivalence', post('/users', { name: '   ' }), 400),
  check(
    'X01',
    '外部支付拒绝',
    'PAYMENT',
    'dependency',
    post('/payments', { paymentToken: 'declined-fixture' }),
    402,
    { status: 'declined' },
  ),
];
