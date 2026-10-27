import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

export function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(value));
}
export async function body(request: IncomingMessage): Promise<unknown> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new Error('team_invalid');
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 1_048_576) throw new Error('team_too_large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('team_invalid');
  }
}
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
export async function staticFile(root: string, pathname: string, response: ServerResponse) {
  // Only the compiled entry and its assets are public; never expose repository files.
  if (pathname !== '/' && pathname !== '/index.html' && !/^\/assets\/[A-Za-z0-9_.-]+$/.test(pathname))
    throw new Error('team_not_found');
  const file = await realpath(path.join(root, pathname === '/' ? 'index.html' : pathname));
  const canonicalRoot = await realpath(root);
  if (!file.startsWith(canonicalRoot + path.sep)) throw new Error('team_not_found');
  const content = await readFile(file);
  response.writeHead(200, {
    'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  response.end(content);
}
