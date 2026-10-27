import { useRef } from 'react';
import { CheckCheck, FileInput, Languages, Moon, Save, Sun, Upload, Workflow } from 'lucide-react';
import { useI18n } from '../shared/i18n/context';
import type { Locale } from '../shared/i18n/messages';
import { Status } from '../shared/components/Status';
import type { Page } from './navigation';
import type { useWorkbench } from './useWorkbench';

type WorkbenchState = ReturnType<typeof useWorkbench>;

export function Titlebar({
  page,
  locale,
  setLocale,
  dark,
  toggleTheme,
}: {
  page: Page;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dark: boolean;
  toggleTheme: () => void;
}) {
  const { t } = useI18n();
  return (
    <header className="app-titlebar">
      <span>
        {t('project')}
        <span className="app-breadcrumb-slash">/</span>
        {t(page)}
      </span>
      <div className="app-global-controls">
        <label className="wb-language">
          <Languages size={14} />
          <select
            aria-label={t('language')}
            value={locale}
            onChange={(event) => setLocale(event.target.value === 'en-US' ? 'en-US' : 'zh-CN')}
          >
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
          </select>
        </label>
        <button className="workbench-btn wb-icon" aria-label={t('theme')} onClick={toggleTheme}>
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
}

export function PageHeading({ page, workbench }: { page: Page; workbench: WorkbenchState }) {
  const { t } = useI18n();
  const definition = workbench.document.definition;
  const presetName = definition.id === 'general-testing' && definition.name === '测试设计验证流程';
  const title = page === 'workflow' ? (presetName ? t('preset') : definition.name) : t(page);
  return (
    <div className="app-page-heading">
      <div>
        <div className="app-eyebrow">{t(page === 'workflow' ? 'template' : page)}</div>
        <h1>
          {title}
          {page === 'workflow' && <Status tone="accent">v{definition.version}</Status>}
        </h1>
      </div>
      <div className="app-page-actions">
        <Status tone={workbench.dirty ? 'warning' : 'neutral'}>
          {t(workbench.dirty ? 'dirty' : 'draft')}
        </Status>
        <button className="workbench-btn" onClick={() => workbench.validate()}>
          <CheckCheck size={15} />
          {t('validate')}
        </button>
        <button className="workbench-btn wb-primary" onClick={workbench.save}>
          <Save size={15} />
          {t('save')}
        </button>
      </div>
    </div>
  );
}

export function DocumentBar({ workbench }: { workbench: WorkbenchState }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) {
        workbench.setNotice('importFailed');
        return;
      }
      workbench.importDraft(await file.text());
    } catch {
      workbench.setNotice('importFailed');
    }
  }
  return (
    <div className="app-document-bar">
      <span>
        <Workflow size={14} />
        {workbench.document.definition.id}
        <span>·</span>
        {t('revision')} {workbench.document.revision}
      </span>
      <div>
        <button className="workbench-btn wb-text" onClick={() => input.current?.click()}>
          <FileInput size={14} />
          {t('import')}
        </button>
        <button className="workbench-btn wb-text" onClick={workbench.exportDraft}>
          <Upload size={14} />
          {t('export')}
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            void importFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

export function Notifications({ workbench }: { workbench: WorkbenchState }) {
  const { t } = useI18n();
  return (
    <>
      {workbench.notice && (
        <div className="app-notice" role="status">
          {t(workbench.notice)}
        </div>
      )}
      {!!workbench.issues.length && (
        <ul className="app-validation-errors" role="alert">
          {workbench.issues.map((issue, index) => (
            <li key={index}>
              {t(issue.code)} {issue.detail}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function Statusbar() {
  const { t } = useI18n();
  return (
    <footer className="app-statusbar">
      <span>
        <span className="app-environment-dot" />
        {t('local')}
      </span>
      <span>{t('phase')} · v0.1.0</span>
    </footer>
  );
}
