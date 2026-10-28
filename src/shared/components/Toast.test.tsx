// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Toast } from './Toast';
import { useNotice } from '../../app/useNotice';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function Fixture() {
  const { notice, setNotice, dismissNotice } = useNotice(null);
  return (
    <>
      <button onClick={() => setNotice('savedMessage')}>Save</button>
      <button onClick={() => setNotice('saveFailed')}>Fail</button>
      {notice && <Toast key={notice.id} notice={notice} dismiss={dismissNotice} />}
    </>
  );
}
it('restarts the lifetime when the same operation repeats and clears the old timer', () => {
  vi.useFakeTimers();
  render(<Fixture />);
  fireEvent.click(screen.getByText('Save'));
  act(() => vi.advanceTimersByTime(3500));
  fireEvent.click(screen.getByText('Save'));
  act(() => vi.advanceTimersByTime(3500));
  expect(screen.getByRole('status').textContent).toContain('草稿已保存');
  act(() => vi.advanceTimersByTime(501));
  expect(screen.queryByRole('status')).toBeNull();
});
it('pauses while reading and retains errors until dismissed', () => {
  vi.useFakeTimers();
  render(<Fixture />);
  fireEvent.click(screen.getByText('Save'));
  fireEvent.pointerEnter(screen.getByRole('status'));
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole('status')).toBeTruthy();
  fireEvent.pointerLeave(screen.getByRole('status'));
  act(() => vi.advanceTimersByTime(4001));
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByText('Fail'));
  act(() => vi.advanceTimersByTime(20000));
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '关闭提示' }));
  expect(screen.queryByRole('alert')).toBeNull();
});
