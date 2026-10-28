import { expect, it } from 'vitest';
import { loadFrameworks, saveFrameworks } from './framework-repository';
import { exampleFramework } from '../domain/execution/presets';
it('roundtrips framework source and rejects shell commands and embedded URL credentials', () => {
  let text = '';
  const storage = {
    getItem: () => text,
    setItem: (_key: string, value: string) => {
      text = value;
    },
  };
  const profile = exampleFramework();
  saveFrameworks(storage, [profile]);
  expect(loadFrameworks(storage)).toEqual([profile]);
  expect(() => saveFrameworks(storage, [{ ...profile, pythonCommand: 'cmd.exe' }])).toThrow('python_invalid');
  expect(() =>
    saveFrameworks(storage, [{ ...profile, targetUrl: 'https://user:secret@example.invalid' }]),
  ).toThrow('target_invalid');
  expect(loadFrameworks(storage)).toEqual([profile]);
});
