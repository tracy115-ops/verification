import { useEffect, useState, Suspense, lazy } from 'react';
import { I18nContext } from '../shared/i18n/context';
import type { Locale } from '../shared/i18n/messages';
import { useWorkbench } from './useWorkbench';
import { Sidebar } from './Sidebar';
import { Titlebar, PageHeading, DocumentBar, Notifications, Statusbar } from './WorkbenchChrome';
import { workspacePage, type Page } from './navigation';

const WorkflowEditor = lazy(() =>
  import('../features/workflows/WorkflowEditor').then((module) => ({ default: module.WorkflowEditor })),
);
const AgentSettings = lazy(() =>
  import('../features/agents/AgentSettings').then((module) => ({ default: module.AgentSettings })),
);
const ReviewWorkspace = lazy(() =>
  import('../features/reviews/ReviewWorkspace').then((module) => ({ default: module.ReviewWorkspace })),
);
const CaseReview = lazy(() =>
  import('../features/reviews/CaseReview').then((module) => ({ default: module.CaseReview })),
);
const RunPlaceholder = lazy(() =>
  import('../features/runs/RunPlaceholder').then((module) => ({ default: module.RunPlaceholder })),
);

function WorkbenchShell({ locale, setLocale }: { locale: Locale; setLocale: (locale: Locale) => void }) {
  const workbench = useWorkbench();
  const [page, setPage] = useState<Page>('workflow');
  const [selectedId, setSelectedId] = useState('design_scenarios');
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (workbench.dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [workbench.dirty]);
  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />
      <main className="app-main">
        <Titlebar
          page={page}
          locale={locale}
          setLocale={setLocale}
          dark={dark}
          toggleTheme={() => setDark(!dark)}
        />
        <PageHeading page={page} workbench={workbench} />
        <DocumentBar workbench={workbench} />
        <Notifications workbench={workbench} />
        <div className="app-content">
          <Suspense fallback={null}>
            {page === 'workflow' && (
              <WorkflowEditor
                document={workbench.document}
                selectedId={selectedId}
                selectNode={setSelectedId}
                update={workbench.update}
                notify={workbench.setNotice}
                openWorkspace={(id) => setPage(workspacePage(id))}
                openAgents={() => setPage('agents')}
              />
            )}
            {page === 'agents' && (
              <AgentSettings
                document={workbench.document}
                update={workbench.update}
                notify={workbench.setNotice}
              />
            )}
            {page === 'assets' && <ReviewWorkspace />}
            {page === 'cases' && <CaseReview />}
            {page === 'runs' && <RunPlaceholder />}
          </Suspense>
        </div>
        <Statusbar />
      </main>
    </div>
  );
}

export function App() {
  const [locale, setLocale] = useState<Locale>('zh-CN');
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <I18nContext.Provider value={locale}>
      <WorkbenchShell locale={locale} setLocale={setLocale} />
    </I18nContext.Provider>
  );
}
