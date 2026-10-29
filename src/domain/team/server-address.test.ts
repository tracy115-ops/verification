import { expect, it } from 'vitest';
import { serverAddress } from './server-address';

it('normalizes IPv4 server origins while excluding paths, credentials and non-unicast endpoints', () => {
  expect(serverAddress(' http://localhost:4317/ ')).toBe('http://127.0.0.1:4317');
  expect(serverAddress('http://172.17.64.1:4331')).toBe('http://172.17.64.1:4331');
  for (const value of [
    'https://192.168.1.1:4317',
    'http://example.com:4317',
    'http://224.0.0.1:4317',
    'http://user:password@127.0.0.1:4317',
    'http://127.0.0.1:4317/api',
    'http://127.0.0.1:4317/?token=a',
    'http://0.0.0.0:4317',
    'http://127.0.0.1',
  ]) {
    expect(() => serverAddress(value)).toThrow('team_address_invalid');
  }
});
