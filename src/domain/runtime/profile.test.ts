import { expect, it } from 'vitest';
import { createDocument } from '../document';
import { inferenceModel } from './profile';
import { profileIsCompatible } from '../workflow';
it('uses CodeAgent internal models and requires explicit models for other CLIs', () => {
  const doc = createDocument();
  const internal = doc.profiles.find((profile) => profile.driver === 'codeagent')!;
  expect(inferenceModel(internal)).toBe('');
  expect(profileIsCompatible({ ...internal, model: 'override' })).toBe(false);
  expect(profileIsCompatible({ ...internal, protocol: 'openai-responses' })).toBe(false);
  for (const profile of doc.profiles.filter((profile) => profile.driver !== 'codeagent')) {
    expect(() => inferenceModel(profile)).toThrow('model_required');
    expect(inferenceModel({ ...profile, model: ' configured-model ' })).toBe('configured-model');
  }
});
