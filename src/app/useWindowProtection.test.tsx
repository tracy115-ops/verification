// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useWindowProtection } from './useWindowProtection';

const mocks = vi.hoisted(() => ({ destroy: vi.fn(), flush: vi.fn(), listen: vi.fn(), pending: vi.fn() }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ destroy: mocks.destroy, onCloseRequested: mocks.listen }),
}));
vi.mock('../services/agent-api', () => ({ hasDesktopBridge: () => true }));
vi.mock('../services/conversation-storage', () => ({
  flushConversationStorage: mocks.flush,
  hasPendingConversationWrites: mocks.pending,
}));
let listener: (event: { preventDefault: () => void }) => void;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending.mockReturnValue(true);
  mocks.flush.mockResolvedValue(undefined);
  mocks.destroy.mockResolvedValue(undefined);
  mocks.listen.mockImplementation(async (callback) => {
    listener = callback;
    return () => {};
  });
});
afterEach(cleanup);
it('waits for the pending database acknowledgement before destroying a clean window', async () => {
  let acknowledge!: () => void;
  mocks.flush.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        acknowledge = resolve;
      }),
  );
  const hook = renderHook(() => useWindowProtection(() => false));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  const preventDefault = vi.fn();
  act(() => listener({ preventDefault }));
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(mocks.destroy).not.toHaveBeenCalled();
  await act(async () => {
    acknowledge();
  });
  expect(mocks.destroy).toHaveBeenCalledOnce();
});
it('shows recovery instead of closing when pending commits cannot be saved', async () => {
  mocks.flush.mockRejectedValue(new Error('store_conflict'));
  const hook = renderHook(() => useWindowProtection(() => false));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  await act(async () => listener({ preventDefault: vi.fn() }));
  expect(hook.result.current.closing).toBe(true);
  expect(hook.result.current.error).toBe(true);
  await act(async () => hook.result.current.close());
  expect(mocks.destroy).not.toHaveBeenCalled();
});
it('retains existing explicit confirmation when unsaved forms or tasks need protection', async () => {
  const hook = renderHook(() => useWindowProtection(() => true));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  act(() => listener({ preventDefault: vi.fn() }));
  expect(hook.result.current.closing).toBe(true);
  expect(mocks.flush).not.toHaveBeenCalled();
  await act(async () => hook.result.current.close());
  expect(mocks.flush).toHaveBeenCalledOnce();
  expect(mocks.destroy).toHaveBeenCalledOnce();
});
