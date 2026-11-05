export interface CliLaunch {
  executablePath?: string;
  configDirectory?: string;
}

export function validCliLaunch(value: unknown, driver: string): value is CliLaunch | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([key, path]) =>
      (key === 'executablePath' || (key === 'configDirectory' && driver === 'claude')) &&
      typeof path === 'string' &&
      path.length > 0 &&
      path.length <= 4096 &&
      !/[\u0000-\u001f\u007f]/.test(path) &&
      /^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(path),
  );
}
