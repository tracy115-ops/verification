import type { FrameworkInspection } from './framework-inspection';

export function inspectionReport(sha = 'a'.repeat(64)): FrameworkInspection {
  return {
    version: 1,
    sourceSha256: sha,
    pythonVersion: '3.11.9',
    checks: [
      { code: 'python', status: 'ok', reason: 'python_supported', line: null },
      { code: 'syntax', status: 'ok', reason: 'syntax_valid', line: null },
      { code: 'limits', status: 'ok', reason: 'limits_valid', line: null },
      { code: 'entry', status: 'ok', reason: 'entry_declared', line: 2 },
    ],
    hints: [{ code: 'setup_declared', line: 3 }],
  };
}
