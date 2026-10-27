export type CoverageState = 'missing' | 'candidate' | 'confirmed';

export function coverageState(states: CoverageState[]): CoverageState | 'unassessed' {
  if (!states.length) return 'unassessed';
  if (states.includes('missing')) return 'missing';
  return states.includes('candidate') ? 'candidate' : 'confirmed';
}
