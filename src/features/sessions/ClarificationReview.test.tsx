// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ClarificationReview } from './ClarificationReview';

afterEach(cleanup);
it('saves only user-entered clarifications and keeps unanswered questions visible', () => {
  const save = vi.fn();
  render(<ClarificationReview issues={['Question A', 'Question B']} busy={false} save={save} />);
  const button = screen.getByRole('button');
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: 'Question A' }), {
    target: { value: 'Confirmed rule' },
  });
  fireEvent.click(button);
  expect(save).toHaveBeenCalledWith({ 'Question A': 'Confirmed rule' });
  expect(screen.getByRole('textbox', { name: 'Question B' })).toBeTruthy();
});
