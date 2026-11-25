import type { FrameworkProfile } from './types';
import { sha256Text } from '../../shared/sha256';

export function validFrameworkModulePath(path: string): boolean {
  return (
    path.length <= 160 &&
    /^sdk\/(?:[a-z_][a-z0-9_]*\/)*[a-z_][a-z0-9_]*\.py$/.test(path) &&
    !path
      .slice(0, -3)
      .split('/')
      .some((part) => /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(part))
  );
}

export function validateFrameworkModules(
  profile: Pick<FrameworkProfile, 'frameworkSource' | 'frameworkModules'>,
) {
  const modules = profile.frameworkModules;
  if (!modules) return;
  const encoder = new TextEncoder();
  const paths = new Set<string>();
  let total = encoder.encode(profile.frameworkSource).length;
  if (modules.length < 1 || modules.length > 24) throw new Error('execution_invalid');
  for (const file of modules) {
    if (!validFrameworkModulePath(file.path) || paths.has(file.path)) throw new Error('execution_invalid');
    paths.add(file.path);
    const bytes = encoder.encode(file.source).length;
    if (bytes > 60000) throw new Error('execution_invalid');
    total += bytes;
  }
  if (total > 128000) throw new Error('execution_invalid');
}

export function frameworkSha256(profile: FrameworkProfile) {
  if (!profile.frameworkModules) return sha256Text(profile.frameworkSource);
  const files = profile.frameworkModules
    .map(({ path, source }) => [path, source])
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return sha256Text(JSON.stringify([['framework.py', profile.frameworkSource], ...files]));
}
