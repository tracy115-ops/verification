import { expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { probeAgents, agentProbeSnapshot, subscribeAgentProbes } from './agent-api';

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: vi.fn() }));

it('shares validated installation snapshots and clears stale results on a failed probe', async () => {
  const probe = {
    driver: 'codex',
    status: 'found',
    version: 'fixture',
    executable: 'fixture-cli',
    reason: null,
  };
  const listener = vi.fn();
  const unsubscribe = subscribeAgentProbes(listener);
  try {
    vi.mocked(invoke).mockResolvedValueOnce([probe]);
    const returned = await probeAgents();
    expect(agentProbeSnapshot()).toEqual([probe]);
    returned[0].version = 'changed-by-caller';
    expect(agentProbeSnapshot()[0].version).toBe('fixture');
    expect(listener).toHaveBeenCalledTimes(1);
    vi.mocked(invoke).mockResolvedValueOnce([probe, probe]);
    await expect(probeAgents()).rejects.toThrow('discoveryFailed');
    expect(agentProbeSnapshot()).toEqual([]);
    vi.mocked(invoke).mockResolvedValueOnce([{ ...probe, status: 'authenticated' }]);
    await expect(probeAgents()).rejects.toThrow('discoveryFailed');
    expect(agentProbeSnapshot()).toEqual([]);
  } finally {
    unsubscribe();
  }
});
