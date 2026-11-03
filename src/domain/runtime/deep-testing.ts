/** Shared by single-call design, batched design and script implementation. */
export const deepTestingGuidance = {
  version: 1,
  scope:
    'Use only approved in-scope requirements, source-supported state preconditions and observable interfaces. These are investigation methods, not extra requirements. Do not invent timing, errors, identities, invariants or dependencies. An unsupported method is not automatically a coverage gap.',
  methods: [
    {
      id: 'transition-sequence',
      investigate:
        'Follow legal and rejected operations across multiple calls. Observe state after rejection, after terminal states, and after reversing an operation; a correct status alone does not establish atomicity.',
    },
    {
      id: 'replay-and-scope',
      investigate:
        'Where idempotency is specified, compare first call with sequential and concurrent replay. Check changed payloads and key scope across users/resources only when those contracts are declared.',
    },
    {
      id: 'conservation',
      investigate:
        'Derive source-backed balance, inventory or cardinality relations. Compare snapshots before/after success, rejection, compensation and replay; include all observable related resources.',
    },
    {
      id: 'dependency-recovery',
      investigate:
        'Use only controllable documented failure modes. Check both the immediate failure and subsequent observable state/recovery; distinguish unknown commit outcome from a proven rollback failure.',
    },
    {
      id: 'concurrent-history',
      investigate:
        'For declared concurrency behavior, retain individual results and final state. Check whether the combined history admits the allowed outcomes; do not use sleep as proof of concurrency.',
    },
    {
      id: 'relational-oracle',
      investigate:
        'Compare source-declared equivalent requests or independent identities/resources. A metamorphic relation needs a stated contract and observable oracle, not an assumed implementation.',
    },
  ],
  design:
    'Prioritize a small set of high-risk journeys and distinct counterexamples, not a Cartesian product. In existing scenario fields, cite requirementIds, identify the method in dimension, state the required action sequence and observable expected relation. Preserve real in-scope uncertainty as gaps; never claim execution.',
  implementation:
    'Put each stateful journey in one independent test method, using the provided framework reset between methods. Save runtime IDs and before/after observations in local variables. Assert setup outcomes, exercise the approved sequence, and assert both declared responses and observable effects. Use only supported framework calls and bounded parallelism. Map methods to approved cases; do not silently add a discovery campaign outside those cases.',
} as const;
