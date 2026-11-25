import { validateFrameworkModules, validFrameworkModulePath } from '../../domain/execution/framework-modules';

export async function readFrameworkFolder(files: File[]) {
  const roots = new Set<string>();
  const entries = files.map((file) => {
    const [root, ...parts] = file.webkitRelativePath.split('/');
    roots.add(root);
    return { file, path: parts.join('/') };
  });
  const entry = entries.filter(({ path }) => path === 'framework.py');
  const modules = entries.filter(({ path }) => validFrameworkModulePath(path));
  if (
    roots.size !== 1 ||
    roots.has('') ||
    entry.length !== 1 ||
    modules.length < 1 ||
    modules.length > 24 ||
    entries.some(
      ({ path }) => path.endsWith('.py') && path !== 'framework.py' && !validFrameworkModulePath(path),
    ) ||
    [entry[0], ...modules].some(({ file }) => file.size > 60000) ||
    [entry[0], ...modules].reduce((size, { file }) => size + file.size, 0) > 128000
  )
    throw new Error('execution_invalid');
  const read = async (file: File) =>
    new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  const snapshot = {
    frameworkSource: await read(entry[0].file),
    frameworkModules: await Promise.all(
      modules.map(async ({ file, path }) => ({ path, source: await read(file) })),
    ),
  };
  validateFrameworkModules(snapshot);
  return snapshot;
}
