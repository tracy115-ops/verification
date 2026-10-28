import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { createProject, projectCommand } from './projects.ts';
import { body, json, staticFile } from './http.ts';
import type { TeamStore } from './store.ts';
import type { TeamRole } from '../src/domain/team/types.ts';
import { uploadSharedScript } from './shared-scripts.ts';
import { inspectPython } from './python-inspection.ts';

function failure(response: ServerResponse, error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const status: Record<string, number> = {
    team_unauthorized: 401,
    team_forbidden: 403,
    team_not_found: 404,
    team_conflict: 409,
    team_analysis_exists: 409,
    team_invalid: 400,
    team_source_invalid: 400,
    team_review_blocked: 422,
    team_too_large: 413,
    team_factor_in_use: 422,
    collab_proposal_stale: 409,
    collab_replace_blocked: 422,
    collab_reference_required: 422,
    collab_script_invalid: 422,
    collab_method_missing: 422,
    collab_evidence_mismatch: 422,
    collab_python_required: 503,
    collab_parser_busy: 429,
    collab_parser_timeout: 504,
  };
  json(response, status[code] ?? 500, { code: status[code] ? code : 'team_server_error' });
}
export function createTeamServer(store: TeamStore, staticRoot: string) {
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const pathname = url.pathname;
      if (pathname === '/api/team/health' && request.method === 'GET') {
        json(response, 200, { version: 1, scope: 'shared_design_review' });
        return;
      }
      if (!pathname.startsWith('/api/team/')) {
        if (request.method !== 'GET') throw new Error('team_not_found');
        await staticFile(staticRoot, pathname, response);
        return;
      }
      if (
        request.headers.origin &&
        request.headers.origin !== `http://${request.headers.host}` &&
        request.headers.origin !== `https://${request.headers.host}`
      )
        throw new Error('team_forbidden');
      const token = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
      const member = store.authenticate(token);
      if (!member) throw new Error('team_unauthorized');
      if (pathname === '/api/team/scripts/inspect' && request.method === 'POST') {
        if (!['admin', 'editor'].includes(member.role)) throw new Error('team_forbidden');
        const input = await body(request);
        if (
          !input ||
          typeof input !== 'object' ||
          !('source' in input) ||
          typeof input.source !== 'string' ||
          Buffer.byteLength(input.source, 'utf8') > 100000
        )
          throw new Error('team_invalid');
        json(response, 200, { methods: await inspectPython(input.source) });
        return;
      }
      if (pathname === '/api/team/me' && request.method === 'GET') {
        json(response, 200, member);
        return;
      }
      if (pathname === '/api/team/members') {
        if (request.method === 'GET') {
          json(response, 200, store.members());
          return;
        }
        if (request.method === 'POST') {
          if (member.role !== 'admin') throw new Error('team_forbidden');
          const value = await body(request);
          if (
            typeof value !== 'object' ||
            !value ||
            !('name' in value) ||
            typeof value.name !== 'string' ||
            !('role' in value) ||
            typeof value.role !== 'string'
          )
            throw new Error('team_invalid');
          json(response, 201, store.addMember(value.name, value.role as TeamRole));
          return;
        }
      }
      if (pathname === '/api/team/projects') {
        if (request.method === 'GET') {
          json(response, 200, store.list());
          return;
        }
        if (request.method === 'POST') {
          json(response, 201, createProject(store, member, await body(request)));
          return;
        }
      }
      const match =
        /^\/api\/team\/projects\/(P_[a-f0-9-]+)(?:\/(commands|scripts|history|revisions\/([0-9]+)))?$/.exec(
          pathname,
        );
      if (match) {
        if (request.method === 'POST' && match[2] === 'scripts') {
          json(response, 200, await uploadSharedScript(store, member, match[1], await body(request)));
          return;
        }
        if (request.method === 'GET') {
          const result =
            match[2] === 'history'
              ? store.history(match[1])
              : match[3]
                ? store.revision(match[1], Number(match[3]))
                : store.get(match[1]);
          json(response, 200, result);
          return;
        }
        if (request.method === 'POST' && match[2] === 'commands') {
          json(response, 200, projectCommand(store, member, match[1], await body(request)));
          return;
        }
      }
      throw new Error('team_not_found');
    } catch (error) {
      if (!response.headersSent) failure(response, error);
      else response.end();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxRequestsPerSocket = 1000;
  return server;
}
