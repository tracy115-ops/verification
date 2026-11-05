import { useSyncExternalStore } from 'react';
import { agentProbeSnapshot, subscribeAgentProbes } from '../services/agent-api';

export function useAgentProbes() {
  return useSyncExternalStore(subscribeAgentProbes, agentProbeSnapshot);
}
