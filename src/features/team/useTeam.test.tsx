// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTeam } from './useTeam';
import { TEAM_TOKEN_KEY } from '../../services/team-api';

const api = vi.hoisted(() => ({ me: vi.fn(), members: vi.fn(), projects: vi.fn() }));
vi.mock('../../services/team-api', () => ({
  TEAM_TOKEN_KEY: 'test-team-token',
  TeamApi: class {
    me = api.me;
    members = api.members;
    projects = api.projects;
  },
}));
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});

it('keeps tokens isolated by server and clears only the signed-out identity', async () => {
  const first = `${TEAM_TOKEN_KEY}:http://127.0.0.1:4317`;
  const second = `${TEAM_TOKEN_KEY}:http://127.0.0.1:4331`;
  sessionStorage.setItem(first, 'first-server-token');
  const { result } = renderHook(() => useTeam('http://127.0.0.1:4331'));
  expect(api.me).not.toHaveBeenCalled();
  api.me.mockResolvedValue({ id: 'M1', name: 'Editor', role: 'editor' });
  api.members.mockResolvedValue([]);
  api.projects.mockResolvedValue([]);
  act(() => result.current.login('second-server-token'));
  expect(result.current.authenticating).toBe(true);
  await waitFor(() => expect(result.current.member?.id).toBe('M1'));
  expect(sessionStorage.getItem(first)).toBe('first-server-token');
  expect(sessionStorage.getItem(second)).toBe('second-server-token');
  act(() => result.current.logout());
  expect(sessionStorage.getItem(first)).toBe('first-server-token');
  expect(sessionStorage.getItem(second)).toBeNull();
});

it('verifies a restored identity and supports retrying the same rejected token', async () => {
  sessionStorage.setItem(`${TEAM_TOKEN_KEY}:http://127.0.0.1:4317`, 'same-token');
  api.me.mockRejectedValueOnce(new Error('team_unauthorized'));
  api.members.mockResolvedValue([]);
  api.projects.mockResolvedValue([]);
  const { result } = renderHook(() => useTeam('http://127.0.0.1:4317'));
  expect(result.current.authenticating).toBe(true);
  await waitFor(() => expect(result.current.error).toBe('team_unauthorized'));
  expect(result.current.authenticating).toBe(false);
  api.me.mockResolvedValue({ id: 'M1', name: 'Reviewer', role: 'reviewer' });
  act(() => result.current.login('same-token'));
  await waitFor(() => expect(result.current.member?.role).toBe('reviewer'));
  expect(api.me).toHaveBeenCalledTimes(2);
});
