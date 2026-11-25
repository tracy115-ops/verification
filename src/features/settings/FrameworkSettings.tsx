import { RetainedView } from '../../shared/components/RetainedView';
import { useRef, useState } from 'react';
import { useDraftStore, useProtectedDraft } from '../../shared/drafts/context';
import { DraftActions } from './DraftActions';
import type { Frameworks } from '../../app/useFrameworks';
import type { FrameworkProfile } from '../../domain/execution/types';
import { exampleFramework } from '../../domain/execution/presets';
import { newId } from '../../shared/id';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { FrameworkInspection } from './FrameworkInspection';
import { readFrameworkFolder } from './read-framework-folder';

export function FrameworkSettings({ settings }: { settings: Frameworks }) {
  const { t } = useI18n();
  const store = useDraftStore();
  const [selected, setSelected] = useState(settings.profiles[0]?.id ?? '');
  const [fresh, setFresh] = useState<FrameworkProfile | null>(null);
  return (
    <section className="settings-frameworks">
      <h2>{t('frameworkSettings')}</h2>
      <p className="wb-muted">{t('frameworkSettingsHint')}</p>
      <div className="settings-framework-toolbar">
        <label className="wb-field">
          {t('frameworkProfile')}
          <select
            className="workbench-select"
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
            }}
          >
            {fresh && <option value={fresh.id}>{fresh.name || t('newFramework')}</option>}
            {settings.profiles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="workbench-btn"
          onClick={() => {
            if (fresh) {
              setSelected(fresh.id);
              return;
            }
            const id = `framework-${newId()}`;
            setSelected(id);
            setFresh({
              ...exampleFramework(),
              id,
              name: '',
              frameworkSource: '',
              targetUrl: 'http://127.0.0.1:4320',
            });
          }}
        >
          {t('newFramework')}
        </button>
        {fresh?.id === selected && (
          <button
            className="workbench-btn wb-text"
            onClick={() => {
              if (fresh) store?.discard(`framework:${fresh.id}`);
              setFresh(null);
              setSelected(settings.profiles[0]?.id ?? '');
            }}
          >
            {t('cancelAction')}
          </button>
        )}
      </div>
      {settings.error && (
        <p className="wb-error" role="alert">
          {isMessageKey(settings.error) ? t(settings.error) : t('execution_invalid')}
        </p>
      )}
      {[...settings.profiles, ...(fresh ? [fresh] : [])].map((profile) => (
        <RetainedView key={profile.id} active={profile.id === selected}>
          <FrameworkForm
            initial={profile}
            open={() => setSelected(profile.id)}
            save={(value) => {
              if (settings.save(value)) {
                setSelected(value.id);
                setFresh(null);
                return true;
              }
              return false;
            }}
          />
        </RetainedView>
      ))}
    </section>
  );
}
function FrameworkForm({
  initial,
  save,
  open,
}: {
  initial: FrameworkProfile;
  open: () => void;
  save: (value: FrameworkProfile) => boolean;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const sourceInput = useRef<HTMLTextAreaElement>(null);
  const draft = useProtectedDraft({
    id: `framework:${initial.id}`,
    section: 'frameworks',
    title: initial.name,
    label: initial.name ? 'frameworkSettings' : 'newFramework',
    open: () => {
      open();
      requestAnimationFrame(() => input.current?.focus());
    },
    initial: { value: initial, reading: false },
  });
  const { value, reading } = draft.value;
  const generation = useRef(0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  function change(patch: Partial<FrameworkProfile>) {
    draft.change((current) => ({ ...current, value: { ...current.value, ...patch } }));
    setSaved(false);
  }
  async function read(files: File[], folder = false) {
    if (!files.length) return;
    const token = ++generation.current;
    const originalSource = value.frameworkSource;
    const originalModules = value.frameworkModules;
    draft.change((current) => ({ ...current, reading: true }));
    try {
      if (!folder && files[0].size > 60000) throw new Error('too_large');
      const patch = folder
        ? await readFrameworkFolder(files)
        : { frameworkSource: await files[0].text(), frameworkModules: undefined };
      if (token !== generation.current || draft.current()?.reading === false) return;
      if (!draft.current()) return;
      if (
        draft.current()?.value.frameworkSource !== originalSource ||
        draft.current()?.value.frameworkModules !== originalModules
      ) {
        draft.change((current) => ({ ...current, reading: false }));
        return;
      }
      draft.change((current) => ({ reading: false, value: { ...current.value, ...patch } }));
      setSaved(false);
      setError(false);
    } catch {
      if (token === generation.current && draft.current()?.reading) {
        draft.change((current) => ({ ...current, reading: false }));
        setError(true);
      }
    }
  }

  return (
    <form
      className="settings-framework-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (reading || draft.conflicted) return;
        const success = save(value);
        setSaved(success);
        if (success) draft.reset();
      }}
    >
      <div className="settings-fields">
        <label className="wb-field">
          {t('frameworkName')}
          <input
            className="workbench-input"
            required
            maxLength={200}
            ref={input}
            value={value.name}
            onChange={(event) => change({ name: event.target.value })}
          />
        </label>
        <label className="wb-field">
          {t('pythonCommand')}
          <input
            className="workbench-input"
            required
            maxLength={2000}
            value={value.pythonCommand}
            onChange={(event) => change({ pythonCommand: event.target.value })}
          />
        </label>
        <label className="wb-field">
          {t('targetUrl')}
          <input
            className="workbench-input"
            type="url"
            required
            value={value.targetUrl}
            onChange={(event) => change({ targetUrl: event.target.value })}
          />
        </label>
        <label className="wb-field">
          {t('executionTimeout')}
          <input
            className="workbench-input"
            type="number"
            min={1}
            max={300}
            required
            value={value.timeoutSeconds}
            onChange={(event) => change({ timeoutSeconds: Number(event.target.value) })}
          />
        </label>
      </div>
      <label className="wb-field">
        {t('frameworkInstructions')}
        <textarea
          className="workbench-textarea"
          maxLength={12000}
          value={value.instructions}
          onChange={(event) => change({ instructions: event.target.value })}
        />
      </label>
      <label className="wb-field">
        {t('frameworkSource')}
        <textarea
          ref={sourceInput}
          aria-label={t('frameworkSource')}
          className="workbench-textarea wb-code"
          wrap="off"
          required
          maxLength={60000}
          value={value.frameworkSource}
          onChange={(event) => change({ frameworkSource: event.target.value })}
        />
      </label>
      <label className="wb-field">
        {t('loadFrameworkFile')}
        <input
          type="file"
          className="workbench-file"
          accept=".py,text/x-python"
          onChange={(event) => {
            void read(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </label>
      <FrameworkFolderInput modules={value.frameworkModules} read={(files) => void read(files, true)} />
      {value.frameworkModules ? (
        <p className="wb-muted">{t('frameworkModuleInspection')}</p>
      ) : (
        <FrameworkInspection
          value={value}
          disabled={reading}
          openLine={(line) => {
            const field = sourceInput.current;
            if (!field) return;
            const lines = field.value.split('\n');
            const start = lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0);
            field.focus();
            field.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
            const lineHeight = Number.parseFloat(getComputedStyle(field).lineHeight);
            field.scrollTop = Math.max(0, (line - 1) * lineHeight - field.clientHeight / 2);
            field.scrollLeft = 0;
          }}
        />
      )}
      <p className="wb-banner">{t('trustedFrameworkHint')}</p>
      {error && <p className="wb-error">{t('framework_read_failed')}</p>}
      <button className="workbench-btn wb-primary" type="submit" disabled={reading || draft.conflicted}>
        {t('saveFramework')}
      </button>
      <DraftActions dirty={draft.dirty} reset={draft.reset} conflicted={draft.conflicted} />
      {saved && <p role="status">{t('settingsSaved')}</p>}
    </form>
  );
}

function FrameworkFolderInput({
  modules,
  read,
}: {
  modules: FrameworkProfile['frameworkModules'];
  read: (files: File[]) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <>
      <label className="wb-field">
        {t('loadFrameworkFolder')}
        <input
          type="file"
          className="workbench-file"
          ref={(element) => element?.setAttribute('webkitdirectory', '')}
          onChange={(event) => {
            read(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </label>
      {modules && (
        <details>
          <summary>
            {t('frameworkModuleFiles').replace(
              '{count}',
              new Intl.NumberFormat(locale).format(modules.length),
            )}
          </summary>
          <ul>
            {modules.map((item) => (
              <li key={item.path}>
                <code>{item.path}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
