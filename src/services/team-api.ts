import { decodeProject } from '../domain/team/rules';
import type { ScriptInput } from '../domain/team/collaboration';
import type {
  ProjectInput,
  ProjectSummary,
  TeamCommand,
  TeamHistory,
  TeamMember,
  TeamProject,
  TeamRole,
} from '../domain/team/types';

export const TEAM_TOKEN_KEY = 'verification-workbench.team-token.v1';
export class TeamApi {
  constructor(private token: string) {}
  async request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`/api/team${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error('team_unavailable');
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new Error('team_unavailable');
    }
    if (!response.ok)
      throw new Error(
        typeof value === 'object' && value && 'code' in value ? String(value.code) : 'team_server_error',
      );
    return value;
  }
  async me(): Promise<TeamMember> {
    const value = await this.request('/me');
    if (!isMember(value)) throw new Error('team_invalid');
    return value;
  }
  async members(): Promise<TeamMember[]> {
    const value = await this.request('/members');
    if (!Array.isArray(value) || !value.every(isMember)) throw new Error('team_invalid');
    return value;
  }
  async addMember(name: string, role: TeamRole): Promise<TeamMember & { token: string }> {
    const value = await this.request('/members', 'POST', { name, role });
    if (!isMember(value) || !('token' in value) || typeof value.token !== 'string')
      throw new Error('team_invalid');
    return { ...value, token: value.token };
  }
  async projects(): Promise<ProjectSummary[]> {
    const value = await this.request('/projects');
    if (
      !Array.isArray(value) ||
      !value.every(
        (item) =>
          typeof item === 'object' &&
          item &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          ['black_box', 'collaborative'].includes(item.mode) &&
          Number.isInteger(item.revision) &&
          typeof item.updatedAt === 'string',
      )
    )
      throw new Error('team_invalid');
    return value as ProjectSummary[];
  }
  async project(id: string): Promise<TeamProject> {
    return decodeProject(await this.request(`/projects/${id}`));
  }
  async create(input: ProjectInput): Promise<TeamProject> {
    return decodeProject(await this.request('/projects', 'POST', input));
  }
  async command(id: string, revision: number, command: TeamCommand): Promise<TeamProject> {
    return decodeProject(await this.request(`/projects/${id}/commands`, 'POST', { revision, command }));
  }
  async history(id: string): Promise<TeamHistory[]> {
    const value = await this.request(`/projects/${id}/history`);
    if (
      !Array.isArray(value) ||
      !value.every(
        (item) =>
          typeof item === 'object' &&
          item &&
          Number.isInteger(item.revision) &&
          typeof item.action === 'string' &&
          typeof item.actor === 'string' &&
          typeof item.at === 'string',
      )
    )
      throw new Error('team_invalid');
    return value as TeamHistory[];
  }
  async uploadScript(id: string, revision: number, script: ScriptInput): Promise<TeamProject> {
    return decodeProject(await this.request(`/projects/${id}/scripts`, 'POST', { revision, script }));
  }
  async inspectScript(source: string): Promise<string[]> {
    const result = await this.request('/scripts/inspect', 'POST', { source });
    if (
      !result ||
      typeof result !== 'object' ||
      !('methods' in result) ||
      !Array.isArray(result.methods) ||
      !result.methods.every((item) => typeof item === 'string')
    )
      throw new Error('team_invalid');
    return result.methods;
  }
}
function isMember(value: unknown): value is TeamMember {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'role' in value &&
    ['admin', 'editor', 'reviewer', 'viewer'].includes(String(value.role))
  );
}
