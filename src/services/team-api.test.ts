import { afterEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { TeamApi } from './team-api';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it('routes desktop requests only to the selected native server and preserves service errors', async () => {
  const api = new TeamApi('personal-test-token', 'http://127.0.0.1:4331');
  vi.mocked(invoke).mockResolvedValueOnce({
    status: 200,
    body: { id: 'M1', name: 'Reviewer', role: 'reviewer' },
  });
  expect((await api.me()).role).toBe('reviewer');
  expect(invoke).toHaveBeenCalledWith('team_request', {
    server: 'http://127.0.0.1:4331',
    token: 'personal-test-token',
    path: '/me',
    method: 'GET',
    body: null,
  });
  vi.mocked(invoke).mockResolvedValueOnce({ status: 409, body: { code: 'team_conflict' } });
  await expect(api.request('/projects/P1/commands', 'POST', {})).rejects.toThrow('team_conflict');
  vi.mocked(invoke).mockRejectedValueOnce('team_unavailable');
  await expect(api.me()).rejects.toThrow('team_unavailable');
});
