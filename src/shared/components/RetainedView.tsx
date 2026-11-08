import { Activity, Suspense, useState, type ReactNode } from 'react';

/** Preserve visited UI state; hidden views release their effects and subscriptions. */
export function RetainedView({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  if (!active && !visited) return null;
  return (
    <Activity mode={active ? 'visible' : 'hidden'}>
      <Suspense fallback={null}>{children}</Suspense>
    </Activity>
  );
}
