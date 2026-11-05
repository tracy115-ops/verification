import { expect, it } from 'vitest';
import { createDocument } from '../document';
import { inferenceModel, nativeAgentFields } from './profile';
import { chatRequest, createSession, message } from './chat';
import { decodeDocument, shareableDocument } from '../document';
import { profileIsCompatible } from '../workflow';
import { supportsInference } from '../agent-capabilities';
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

it('keeps saved Provider drafts separate from executable native profiles', () => {
  const native = createDocument().profiles[0];
  expect(supportsInference(native)).toBe(true);
  expect(() => inferenceModel(native)).toThrow('model_required');
  const provider = {
    ...native,
    protocol: 'openai-responses' as const,
    model: 'example',
    baseUrl: 'https://example.invalid',
  };
  expect(profileIsCompatible(provider)).toBe(true);
  expect(supportsInference(provider)).toBe(false);
  expect(() => nativeAgentFields(provider)).toThrow('unsupported_profile');
});

it('preserves independent Claude instance bindings in persistence and chat requests', () => {
  const doc = createDocument();
  const profile = doc.profiles.find((item) => item.driver === 'claude')!;
  profile.model = 'fixture-model';
  profile.launch = {
    executablePath: 'D:\\Claude One\\claude.cmd',
    configDirectory: 'D:\\Config One',
    settingsFile: 'D:\\Config One\\custom.json',
  };
  const restored = decodeDocument(JSON.parse(JSON.stringify(doc)));
  const first = restored.profiles.find((item) => item.driver === 'claude')!;
  const session = createSession(first.id);
  session.messages.push(message('user', 'hello'));
  const request = chatRequest(session, first);
  expect(request.launch).toEqual(profile.launch);
  expect(shareableDocument(doc).profiles.every((item) => item.launch === undefined)).toBe(true);
  expect(profile.launch).toBeDefined();
  first.launch!.configDirectory = 'D:\\Config Two';
  expect(request.launch?.configDirectory).toBe('D:\\Config One');
  expect(nativeAgentFields(first).launch?.configDirectory).toBe('D:\\Config Two');
});

it('rejects relative paths, command strings, unknown launch fields and non-Claude config directories', () => {
  const profile = createDocument().profiles[0];
  for (const launch of [
    { executablePath: 'claude --model example' },
    { executablePath: 'D:\\tools\\cli.exe\n' },
    { configDirectory: 'D:\\config' },
    { settingsFile: 'D:\\settings.json' },
    { executablePath: 'D:\\cli.exe', args: '--secret' },
  ])
    expect(profileIsCompatible({ ...profile, launch })).toBe(false);
});
