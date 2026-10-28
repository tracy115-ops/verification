import { lazy, Suspense, useEffect, useState } from 'react';
import { useWorkbench } from './useWorkbench';
import { useConversations } from './useConversations';
import { useFrameworks } from './useFrameworks';
import { Sidebar } from './Sidebar';
import { Titlebar, PageHeading, DocumentBar, Notifications, Statusbar } from './WorkbenchChrome';
import { workspacePage, type Page } from './navigation';
import type { Appearance, SettingsTab } from '../features/settings/SettingsPage';

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

export function Workbench({ appearance }: { appearance: Appearance }) {
  const workbench = useWorkbench();
  const frameworks = useFrameworks();
  const conversations = useConversations(workbench.document.profiles, workbench.savedDocument);
  const [page, setPage] = useState<Page>('sessions');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [selectedId, setSelectedId] = useState('design_scenarios');
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (workbench.dirty || conversations.busy) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [workbench.dirty, conversations.busy]);
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
      <Sidebar page={page} setPage={navigate} />
      <main className="app-main">
        <Titlebar page={page} busy={conversations.busy} />
        <PageHeading page={page} workbench={workbench} />
        {page === 'workflow' && <DocumentBar workbench={workbench} />}
        <Notifications workbench={workbench} />
        <div className="app-content">
          <Suspense fallback={null}>
            {page === 'team' && <TeamWorkspace />}
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
              />
            )}
            {(page === 'assets' || page === 'cases') && (
              <AssetsWorkspace
                key={page}
                sessions={conversations.sessions}
                initialView={page === 'cases' ? 'cases' : 'requirements'}
                initialRunId={conversations.selectedRunId || conversations.session?.runs.at(-1)?.id}
              />
            )}
            {page === 'runs' && (
              <RunRecords
                actions={conversations}
                openSession={(id, runId) => {
                  conversations.setActiveId(id);
                  conversations.setSelectedRunId(runId);
                  setPage('sessions');
                }}
              />
            )}
          </Suspense>
        </div>
        <Statusbar />
      </main>
    </div>
  );
}
