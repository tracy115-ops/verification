import Ajv2020 from 'ajv/dist/2020.js';

export type FrameworkCheckCode = 'python' | 'syntax' | 'limits' | 'entry';
export type FrameworkCheckReason =
  | 'not_checked'
  | 'python_supported'
  | 'python_version_unsupported'
  | 'syntax_valid'
  | 'syntax_error'
  | 'limits_valid'
  | 'script_file_limit'
  | 'script_function_limit'
  | 'entry_declared'
  | 'entry_missing'
  | 'entry_dynamic'
  | 'entry_unverified_base';
export type FrameworkHintCode =
  'setup_declared' | 'teardown_declared' | 'target_env_mentioned' | 'evidence_env_mentioned';
export interface FrameworkInspection {
  version: 1;
  sourceSha256: string;
  pythonVersion: string;
  checks: {
    code: FrameworkCheckCode;
    status: 'ok' | 'error' | 'unknown';
    reason: FrameworkCheckReason;
    line: number | null;
  }[];
  hints: { code: FrameworkHintCode; line: number }[];
}
const reasons = [
  'not_checked',
  'python_supported',
  'python_version_unsupported',
  'syntax_valid',
  'syntax_error',
  'limits_valid',
  'script_file_limit',
  'script_function_limit',
  'entry_declared',
  'entry_missing',
  'entry_dynamic',
  'entry_unverified_base',
];
const line = { type: 'integer', minimum: 1, maximum: 2000 };
const validate = new Ajv2020({ strict: false }).compile<FrameworkInspection>({
  type: 'object',
  additionalProperties: false,
  required: ['version', 'sourceSha256', 'pythonVersion', 'checks', 'hints'],
  properties: {
    version: { const: 1 },
    sourceSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    pythonVersion: { type: 'string', minLength: 1, maxLength: 64 },
    checks: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'status', 'reason', 'line'],
        properties: {
          code: { enum: ['python', 'syntax', 'limits', 'entry'] },
          status: { enum: ['ok', 'error', 'unknown'] },
          reason: { enum: reasons },
          line: { anyOf: [line, { type: 'null' }] },
        },
      },
    },
    hints: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'line'],
        properties: {
          code: {
            enum: ['setup_declared', 'teardown_declared', 'target_env_mentioned', 'evidence_env_mentioned'],
          },
          line,
        },
      },
    },
  },
});
const allowed = {
  python: { ok: ['python_supported'], error: ['python_version_unsupported'], unknown: [] },
  syntax: { ok: ['syntax_valid'], error: ['syntax_error'], unknown: ['not_checked'] },
  limits: {
    ok: ['limits_valid'],
    error: ['script_file_limit', 'script_function_limit'],
    unknown: ['not_checked'],
  },
  entry: {
    ok: ['entry_declared'],
    error: ['entry_missing'],
    unknown: ['not_checked', 'entry_dynamic', 'entry_unverified_base'],
  },
};
export function decodeFrameworkInspection(value: unknown): FrameworkInspection {
  if (
    !validate(value) ||
    value.checks.map((item) => item.code).join(',') !== 'python,syntax,limits,entry' ||
    value.checks.some((item) => !(allowed[item.code][item.status] as string[]).includes(item.reason)) ||
    new Set(value.hints.map((item) => item.code)).size !== value.hints.length
  )
    throw new Error('framework_inspection_invalid');
  return value;
}
export function frameworkInspectionState(report?: FrameworkInspection) {
  if (!report) return 'unchecked';
  if (report.checks.some((item) => item.status === 'error')) return 'blocked';
  return report.checks.some((item) => item.status === 'unknown') ? 'unverified' : 'checked';
}
