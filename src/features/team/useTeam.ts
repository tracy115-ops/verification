import { useEffect, useRef, useState } from 'react';
import { TeamApi, TEAM_TOKEN_KEY } from '../../services/team-api';
import type {
  ProjectInput,
  ProjectSummary,
  TeamCommand,
  TeamHistory,
  TeamMember,
  TeamProject,
} from '../../domain/team/types';

export function useTeam() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TEAM_TOKEN_KEY) ?? '');
  const [member, setMember] = useState<TeamMember | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<TeamProject | null>(null);
  const [history, setHistory] = useState<TeamHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const generation = useRef(0);
  const api = new TeamApi(token);
  useEffect(() => {
    let alive = true;
    if (!token) return;
    const client = new TeamApi(token);
    void Promise.all([client.me(), client.members(), client.projects()])
      .then(([me, people, list]) => {
        if (alive) {
          setMember(me);
          setMembers(people);
          setProjects(list);
          setError(null);
        }
      })
      .catch((error) => {
        if (alive) {
          setMember(null);
          setError(error instanceof Error ? error.message : 'team_unavailable');
        }
      });
    return () => {
      alive = false;
    };
  }, [token]);
  useEffect(() => {
    if (!token || !member) return;
    let alive = true;
    const client = new TeamApi(token);
    const timer = setInterval(() => {
      if (guard.current) return;
      const started = generation.current;
      void Promise.all([
        client.projects(),
        client.members(),
        ...(project ? [client.project(project.id), client.history(project.id)] : []),
      ])
        .then(([list, people, next, events]) => {
          if (!alive || guard.current || started !== generation.current) return;
          setProjects(list as ProjectSummary[]);
          setMembers(people as TeamMember[]);
          if (next)
            setProject((previous) =>
              previous?.id === (next as TeamProject).id && previous.revision < (next as TeamProject).revision
                ? (next as TeamProject)
                : previous,
            );
          if (events) setHistory(events as TeamHistory[]);
        })
        .catch((error) => {
          if (alive) setError(error instanceof Error ? error.message : 'team_unavailable');
        });
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [token, member, project?.id]);
  async function perform(task: () => Promise<void>): Promise<boolean> {
    if (guard.current) return false;
    generation.current++;
    guard.current = true;
    setBusy(true);
    setError(null);
    try {
      await task();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'team_server_error');
      return false;
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  async function select(id: string) {
    await perform(async () => {
      const next = await api.project(id);
      const events = await api.history(id);
      setProject(next);
      setHistory(events);
    });
  }
  async function refresh() {
    if (project) await select(project.id);
  }
  async function create(input: ProjectInput) {
    return perform(async () => {
      const next = await api.create(input);
      setProject(next);
      setHistory(await api.history(next.id));
      setProjects(await api.projects());
    });
  }
  async function command(command: TeamCommand, revision = project?.revision) {
    if (!project || !revision) return false;
    return perform(async () => {
      const next = await api.command(project.id, revision, command);
      setProject(next);
      setHistory(await api.history(next.id));
      setProjects(await api.projects());
    });
  }
  function login(value: string) {
    setError(null);
    setMember(null);
    sessionStorage.setItem(TEAM_TOKEN_KEY, value.trim());
    setToken(value.trim());
  }
  function logout() {
    sessionStorage.removeItem(TEAM_TOKEN_KEY);
    setToken('');
    setMember(null);
    setProject(null);
    setProjects([]);
    setHistory([]);
  }
  return {
    api,
    member,
    members,
    projects,
    project,
    history,
    error,
    busy,
    login,
    logout,
    select,
    refresh,
    create,
    command,
    setError,
    setMembers,
  };
}
export type TeamActions = ReturnType<typeof useTeam>;
