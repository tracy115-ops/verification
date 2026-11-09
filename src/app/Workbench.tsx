import { useDraftCount, useDraftStore } from '../shared/drafts/context';
import { useWindowProtection } from './useWindowProtection';
import { PendingDrafts } from '../features/settings/PendingDrafts';
import { useI18n } from '../shared/i18n/context';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { RetainedView } from '../shared/components/RetainedView';
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
  const { t } = useI18n();
  const drafts = useDraftStore();
  const draftCount = useDraftCount();
  const [reviewDrafts, setReviewDrafts] = useState(false);
  const workbench = useWorkbench();
  const frameworks = useFrameworks();
  const conversations = useConversations(
    workbench.document.profiles,
    workbench.savedDocument,
    undefined,
    undefined,
    workbench.library,
  );
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
  const protection = useWindowProtection(() => !!drafts?.count() || workbench.dirty || conversations.anyBusy);
  function openAgents() {
    setSettingsTab('agents');
    setPage('settings');
  }
  function navigate(next: Page) {
    setPage(next);
  }
  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={navigate} conversations={conversations} />
      <main className="app-main" data-close-protection={protection.ready ? 'ready' : 'pending'}>
        {protection.unavailable && (
          <p className="wb-error" role="status">
            {t('draftProtectionFailed')}
          </p>
        )}
        {(reviewDrafts || protection.closing) && (
          <PendingDrafts
            close={() => {
              setReviewDrafts(false);
              protection.dismiss();
            }}
            closing={protection.closing}
            quit={() => void protection.close()}
            workflowDirty={workbench.dirty}
            running={conversations.anyBusy}
            error={protection.error}
            openWorkflow={() => setPage('workflow')}
            navigate={(section) => {
              if (section === 'team') setPage('team');
              else {
                setSettingsTab(section);
                setPage('settings');
              }
            }}
          />
        )}

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
            <RetainedView active={page === 'team'}>
              {hasDesktopBridge() ? (
                <DesktopTeamWorkspace
                  openSettings={() => {
                    setSettingsTab('collaboration');
                    setPage('settings');
                  }}
                />
              ) : (
                <TeamWorkspace />
              )}
            </RetainedView>
            {page === 'sessions' && (
              <SessionWorkspace
                actions={conversations}
                profiles={workbench.document.profiles}
                saved={conversations.selectedWorkflow}
                workflows={workbench.library}
                dirty={workbench.dirty}
                frameworks={frameworks.profiles}
                openWorkflow={() => setPage('workflow')}
                openSettings={openAgents}
                openAssets={(cases) => setPage(cases ? 'cases' : 'assets')}
              />
            )}
            <RetainedView active={page === 'workflow'}>
              <WorkflowEditor
                document={workbench.document}
                selectedId={selectedId}
                selectNode={setSelectedId}
                update={workbench.update}
                notify={workbench.setNotice}
                openWorkspace={(id) => setPage(workspacePage(id))}
                openAgents={openAgents}
              />
            </RetainedView>
            <RetainedView active={page === 'settings'}>
              <SettingsPage
                active={page === 'settings'}
                profiles={workbench.document.profiles}
                addProfile={workbench.addProfile}
                notify={workbench.setNotice}
                tab={settingsTab}
                setTab={setSettingsTab}
                appearance={appearance}
                frameworks={frameworks}
                blocked={conversations.anyBusy || workbench.dirty || draftCount > 0}
                reviewDrafts={() => setReviewDrafts(true)}
              />
            </RetainedView>
            <RetainedView active={page === 'assets' || page === 'cases'}>
              <AssetsWorkspace
                actions={conversations}
                updateRun={conversations.busy ? undefined : conversations.updateRun}
                key={`${conversations.activeId}:${conversations.selectedRunId || conversations.session?.runs.at(-1)?.id}`}
                session={conversations.session}
                openSession={() => setPage('sessions')}
                initialView={page === 'cases' ? 'cases' : 'requirements'}
                runId={conversations.selectedRunId || conversations.session?.runs.at(-1)?.id}
              />
            </RetainedView>
            <RetainedView active={page === 'runs'}>
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
            </RetainedView>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
