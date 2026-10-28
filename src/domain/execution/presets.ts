import source from '../../../crates/execution-runtime/python/http_framework.py?raw';
import type { FrameworkProfile } from './types';

export function exampleFramework(): FrameworkProfile {
  return {
    id: 'game-unittest',
    name: 'Game platform / unittest',
    adapter: 'python-unittest-v1',
    pythonCommand: 'python',
    frameworkSource: source,
    instructions:
      'Single-file unittest adapter. Import BlackBoxCase from framework. Use self.client.call(method, path, body=None, user="player-a", headers=None) and self.client.parallel(requests). The example framework resets its game fixture in setUp; replace framework.py with your trusted SDK for other targets. Record request/response JSONL to BLACKBOX_EVIDENCE_FILE and read BLACKBOX_BASE_URL for the target.',
    targetUrl: 'http://127.0.0.1:4320',
    timeoutSeconds: 60,
  };
}
