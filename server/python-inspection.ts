import { spawn } from 'node:child_process';

// Only this trusted parser executes. Submitted Python is passed to ast.parse as data.
const parser = `import ast,json,sys
try:
    source=sys.stdin.read(100001)
    if len(source.splitlines())>2000: raise ValueError('limits')
    tree=ast.parse(source)
    names=[]
    for node in ast.walk(tree):
        if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) and node.end_lineno-node.lineno+1>200: raise ValueError('limits')
        if isinstance(node,ast.ClassDef):
            for method in node.body:
                if isinstance(method,(ast.FunctionDef,ast.AsyncFunctionDef)) and method.name.startswith('test_'):
                    meaningful=[stmt for stmt in method.body if not isinstance(stmt,ast.Pass) and not (isinstance(stmt,ast.Expr) and isinstance(stmt.value,ast.Constant))]
                    if not meaningful: raise ValueError('empty')
                    names.append(method.name)
    if not names or len(names)>300 or len(names)!=len(set(names)): raise ValueError('names')
    print(json.dumps(names))
except Exception:
    sys.exit(2)
`;
let active = 0;
export async function inspectPython(source: string): Promise<string[]> {
  if (active >= 2) throw new Error('collab_parser_busy');
  active++;
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.platform === 'win32' ? 'python' : 'python3', ['-I', '-c', parser], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'],
        shell: false,
      });
      let output = '';
      let settled = false;
      const finish = (error?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill();
        if (error) {
          reject(new Error(error));
          return;
        }
        try {
          const value: unknown = JSON.parse(output);
          if (
            !Array.isArray(value) ||
            !value.length ||
            value.length > 300 ||
            !value.every((name) => typeof name === 'string' && /^test_[A-Za-z0-9_]{1,155}$/.test(name))
          )
            throw new Error();
          resolve(value);
        } catch {
          reject(new Error('collab_script_invalid'));
        }
      };
      const timer = setTimeout(() => finish('collab_parser_timeout'), 3000);
      child.on('error', () => finish('collab_python_required'));
      child.stdout.on('data', (data: Buffer) => {
        output += data.toString('utf8');
        if (output.length > 65536) finish('collab_script_invalid');
      });
      child.on('close', (code) => finish(code === 0 ? undefined : 'collab_script_invalid'));
      child.stdin.on('error', () => {});
      child.stdin.end(source, 'utf8');
    });
  } finally {
    active--;
  }
}
