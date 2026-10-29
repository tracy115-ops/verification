export const TEAM_SERVER_KEY = 'verification-workbench.team-server.v1';

export function serverAddress(value: string): string {
  try {
    const url = new URL(value.trim());
    if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
    const parts = url.hostname.split('.').map(Number);
    const validIp =
      parts.length === 4 &&
      parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
      parts[0] > 0 &&
      parts[0] < 224;
    if (
      value.length > 100 ||
      url.protocol !== 'http:' ||
      !validIp ||
      Number(url.port || 80) < 1024 ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error('team_address_invalid');
  }
}
