import type { DesignArtifact, RequirementArtifact } from '../../src/domain/runtime/types';

// Hand-authored contract fixture, not generated analysis or execution evidence.
export function journeyFixture() {
  const requirements: RequirementArtifact = {
    requirements: [
      {
        id: 'R1',
        text: 'Create a reservation',
        quote: 'Creating an order returns 201 and state reserved.',
        acceptanceCriteria: ['Returns reserved'],
      },
      {
        id: 'R2',
        text: 'Declined payment preserves state',
        quote: 'Declined payment returns 402 and leaves the order reserved.',
        acceptanceCriteria: ['Returns 402; state stays reserved'],
      },
      {
        id: 'R3',
        text: 'Successful payment',
        quote: 'Payment with ok returns 200 and changes reserved to paid.',
        acceptanceCriteria: ['Returns paid'],
      },
    ],
    questions: [],
  };
  const design: DesignArtifact = {
    strategy: 'Observe rejection and subsequent recovery',
    factors: [
      {
        id: 'F1',
        name: 'Payment outcome',
        requirementIds: ['R2', 'R3'],
        levels: ['declined', 'ok'],
        sourceQuote: requirements.requirements[1].quote,
      },
    ],
    scenarios: [
      {
        id: 'S1',
        title: 'Payment refusal and recovery',
        dimension: 'state-sequence',
        requirementIds: ['R1', 'R2', 'R3'],
        expected: 'Decline preserves reserved, then ok changes it to paid.',
        factorLevels: [
          { factorId: 'F1', level: 'declined' },
          { factorId: 'F1', level: 'ok' },
        ],
        journey: {
          version: 1,
          initialState: 'no order',
          preconditions: ['Fresh independent initial state'],
          steps: [
            {
              id: 'T1',
              fromState: 'no order',
              toState: 'reserved',
              action: 'Create an order; retain its runtime ID',
              observation: '201; returned state reserved',
              requirementId: 'R1',
              sourceQuote: requirements.requirements[0].quote,
            },
            {
              id: 'T2',
              fromState: 'reserved',
              toState: 'reserved',
              action: 'Pay with declined using the retained ID',
              observation: '402; order remains reserved',
              requirementId: 'R2',
              sourceQuote: requirements.requirements[1].quote,
            },
            {
              id: 'T3',
              fromState: 'reserved',
              toState: 'paid',
              action: 'Pay the same order with ok',
              observation: '200; returned state paid',
              requirementId: 'R3',
              sourceQuote: requirements.requirements[2].quote,
            },
          ],
        },
      },
    ],
    gaps: [],
  };
  return { requirements, design, spec: requirements.requirements.map((item) => item.quote).join('\n') };
}
