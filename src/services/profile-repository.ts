import Ajv2020 from 'ajv/dist/2020.js';
import { profileSchema } from '../domain/document';
import { profileIsCompatible, type AgentProfile } from '../domain/workflow';

const KEY = 'verification-workbench.profiles.v1';
const validate = new Ajv2020({ strict: false }).compile<AgentProfile[]>({
  type: 'array',
  maxItems: 100,
  items: profileSchema,
});

function decode(value: unknown): AgentProfile[] {
  if (
    !validate(value) ||
    value.some((profile) => !profileIsCompatible(profile)) ||
    new Set(value.map((profile) => profile.id)).size !== value.length
  )
    throw new Error('invalidProfile');
  return structuredClone(value);
}

export function loadProfiles(storage: Pick<Storage, 'getItem'>, fallback: AgentProfile[]): AgentProfile[] {
  const text = storage.getItem(KEY);
  if (!text) return fallback;
  const saved = decode(JSON.parse(text));
  const ids = new Set(saved.map((profile) => profile.id));
  return [...saved, ...fallback.filter((profile) => !ids.has(profile.id))];
}

export function saveProfiles(storage: Pick<Storage, 'setItem'>, profiles: AgentProfile[]): void {
  storage.setItem(KEY, JSON.stringify(decode(profiles)));
}
