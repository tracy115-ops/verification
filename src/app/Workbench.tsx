import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useWorkbench } from './useWorkbench';
import { useConversations } from './useConversations';
import { useFrameworks } from './useFrameworks';
import { Sidebar } from './Sidebar';
import { Titlebar, PageHeading, DocumentBar, Notifications } from './WorkbenchChrome';
import { workspacePage, type Page } from './navigation';
import type { Appearance, SettingsTab } from '../features/settings/SettingsPage';
import { hasDesktopBridge } from '../services/agent-api';

const WorkflowEditor = lazy(() =>
  import('../features/workflows/WorkflowEditor').then((module) => ({ default: module.WorkflowEditor })),
);
const SessionWorkspace = lazy(() =>
  import('../features/sessions/SessionWorkspace').then((module) => ({ default: module.SessionWorkspace })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const AssetsWorkspace = lazy(() =>
  import('../features/reviews/AssetsWorkspace').then((module) => ({ default: module.AssetsWorkspace })),
);
const RunRecords = lazy(() =>
  import('../features/runs/RunRecords').then((module) => ({ default: module.RunRecords })),
);
const TeamWorkspace = lazy(() =>
  import('../features/team/TeamWorkspace').then((module) => ({ default: module.TeamWorkspace })),
);
const DesktopTeamWorkspace = lazy(() =>
  import('../features/team/DesktopTeamWorkspace').then((module) => ({
    default: module.DesktopTeamWorkspace,
  })),
);

export function Workbench({ appearance }: { appearance: Appearance }) {
  const workbench = useWorkbench();
  const frameworks = useFrameworks();
  const conversations = useConversations(workbench.document.profiles, workbench.savedDocument);
  const [page, setPage] = useState<Page>(() =>
    document.documentElement.dataset.workspace === 'team' ? 'team' : 'sessions',
  );
  const previousPage = useRef(page);
  useEffect(() => {
    if (previousPage.current !== page) workbench.setNotice(null);
    previousPage.current = page;
  }, [page, workbench.setNotice]);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [selectedId, setSelectedId] = useState('design_scenarios');
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (workbench.dirty || conversations.anyBusy) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [workbench.dirty, conversations.anyBusy]);
  function openAgents() {
    setSettingsTab('agents');
    setPage('settings');
  }
  function navigate(next: Page) {
    if (next === 'settings') setSettingsTab('general');
    setPage(next);
  }
  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={navigate} conversations={conversations} />
      <main className="app-main">
        {page !== 'assets' && page !== 'cases' && <Titlebar page={page} busy={conversations.busy} />}
        {page !== 'sessions' &&
          page !== 'assets' &&
          page !== 'cases' &&
          page !== 'runs' &&
          page !== 'team' && <PageHeading page={page} workbench={workbench} />}
        {page === 'workflow' && <DocumentBar workbench={workbench} />}
        <Notifications workbench={workbench} page={page} />
        <div className="app-content">
          <Suspense fallback={null}>
            {page === 'team' &&
              (hasDesktopBridge() ? (
                <DesktopTeamWorkspace
                  openSettings={() => {
                    setSettingsTab('collaboration');
                    setPage('settings');
                  }}
                />
              ) : (
                <TeamWorkspace />
              ))}
            {page === 'sessions' && (
              <SessionWorkspace
                actions={conversations}
                profiles={workbench.document.profiles}
                saved={workbench.savedDocument}
                dirty={workbench.dirty}
                frameworks={frameworks.profiles}
                openWorkflow={() => setPage('workflow')}
                openSettings={openAgents}
                openAssets={(cases) => setPage(cases ? 'cases' : 'assets')}
              />
            )}
            {page === 'workflow' && (
              <WorkflowEditor
                document={workbench.document}
                selectedId={selectedId}
                selectNode={setSelectedId}
                update={workbench.update}
                notify={workbench.setNotice}
                openWorkspace={(id) => setPage(workspacePage(id))}
                openAgents={openAgents}
              />
            )}
            {page === 'settings' && (
              <SettingsPage
                profiles={workbench.document.profiles}
                addProfile={workbench.addProfile}
                notify={workbench.setNotice}
                tab={settingsTab}
                setTab={setSettingsTab}
                appearance={appearance}
                frameworks={frameworks}
                blocked={conversations.anyBusy || workbench.dirty}
              />
            )}
            {(page === 'assets' || page === 'cases') && (
              <AssetsWorkspace
                updateRun={conversations.busy ? undefined : conversations.updateRun}
                key={`${page}:${conversations.activeId}:${conversations.selectedRunId}`}
                session={conversations.session}
                openSession={() => setPage('sessions')}
                initialView={page === 'cases' ? 'cases' : 'requirements'}
                runId={conversations.selectedRunId || conversations.session?.runs.at(-1)?.id}
              />
            )}
            {page === 'runs' && (
              <RunRecords
                actions={conversations}
                openAssets={(id, runId) => {
                  conversations.setActiveId(id);
                  conversations.setSelectedRunId(runId);
                  setPage('assets');
                }}
                openSession={(id, runId) => {
                  conversations.setActiveId(id);
                  conversations.setSelectedRunId(runId);
                  setPage('sessions');
                }}
              />
            )}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
