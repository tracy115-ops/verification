import type { ReactNode } from 'react';

export function Status({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
  children: ReactNode;
}) {
  return (
    <span className={`wb-status wb-status-${tone}`}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}
