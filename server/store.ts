import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { decodeProject } from '../src/domain/team/rules.ts';
import type { TeamHistory, TeamMember, TeamProject, TeamRole } from '../src/domain/team/types.ts';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export class TeamStore {
  private db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file, { timeout: 3000 });
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS metadata (version INTEGER NOT NULL);
      INSERT INTO metadata SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM metadata);
      CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history (project_id TEXT NOT NULL, revision INTEGER NOT NULL, action TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(project_id, revision));`);
    if (this.db.prepare('SELECT version FROM metadata').get()?.version !== 1)
      throw new Error('team_database_version');
  }
  bootstrap(token?: string): string | null {
    if (this.db.prepare('SELECT id FROM members LIMIT 1').get()) return null;
    const credential = token ?? randomBytes(32).toString('hex');
    if (credential.length < 32) throw new Error('team_invalid_token');
    this.addMember('Owner', 'admin', credential);
    return credential;
  }
  addMember(name: string, role: TeamRole, credential = randomBytes(32).toString('hex')) {
    if (!name.trim() || name.length > 80 || !['admin', 'editor', 'reviewer', 'viewer'].includes(role))
      throw new Error('team_invalid');
    const member: TeamMember = { id: `M_${randomBytes(8).toString('hex')}`, name, role };
    this.db.prepare('INSERT INTO members VALUES (?, ?, ?, ?)').run(member.id, name, role, hash(credential));
    return { ...member, token: credential };
  }
  authenticate(token: string): TeamMember | null {
    if (token.length < 32 || token.length > 256) return null;
    const row = this.db.prepare('SELECT id, name, role FROM members WHERE token_hash=?').get(hash(token));
    return row ? { id: String(row.id), name: String(row.name), role: String(row.role) as TeamRole } : null;
  }
  members(): TeamMember[] {
    return this.db
      .prepare('SELECT id, name, role FROM members ORDER BY rowid')
      .all()
      .map((row) => ({ id: String(row.id), name: String(row.name), role: String(row.role) as TeamRole }));
  }
  list() {
    return this.db
      .prepare('SELECT body FROM projects ORDER BY rowid DESC LIMIT 100')
      .all()
      .map((row) => {
        const project = decodeProject(JSON.parse(String(row.body)));
        return {
          id: project.id,
          title: project.title,
          mode: project.mode,
          revision: project.revision,
          updatedAt: project.updatedAt,
        };
      });
  }
  get(id: string): TeamProject {
    const row = this.db.prepare('SELECT body FROM projects WHERE id=?').get(id);
    if (!row) throw new Error('team_not_found');
    return decodeProject(JSON.parse(String(row.body)));
  }
  save(project: TeamProject, expectedRevision: number, action: string, actor: string): TeamProject {
    const valid = decodeProject(project);
    const body = JSON.stringify(valid);
    if (Buffer.byteLength(body) > 1_000_000) throw new Error('team_too_large');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (expectedRevision === 0) {
        this.db.prepare('INSERT INTO projects VALUES (?, ?, ?)').run(valid.id, valid.revision, body);
      } else {
        const result = this.db
          .prepare('UPDATE projects SET revision=?, body=? WHERE id=? AND revision=?')
          .run(valid.revision, body, valid.id, expectedRevision);
        if (result.changes !== 1) throw new Error('team_conflict');
      }
      this.db
        .prepare('INSERT INTO history VALUES (?, ?, ?, ?, ?, ?)')
        .run(valid.id, valid.revision, action, actor, valid.updatedAt, body);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return valid;
  }
  history(id: string): TeamHistory[] {
    return this.db
      .prepare(
        'SELECT revision, action, actor, at FROM history WHERE project_id=? ORDER BY revision DESC LIMIT 100',
      )
      .all(id)
      .map((row) => ({
        revision: Number(row.revision),
        action: String(row.action),
        actor: String(row.actor),
        at: String(row.at),
      }));
  }
  revision(id: string, revision: number): TeamProject {
    const row = this.db
      .prepare('SELECT body FROM history WHERE project_id=? AND revision=?')
      .get(id, revision);
    if (!row) throw new Error('team_not_found');
    return decodeProject(JSON.parse(String(row.body)));
  }
  close() {
    this.db.close();
  }
}
