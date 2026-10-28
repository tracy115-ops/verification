import { useState } from 'react';
import type { Frameworks } from '../../app/useFrameworks';
import type { FrameworkProfile } from '../../domain/execution/types';
import { exampleFramework } from '../../domain/execution/presets';
import { newId } from '../../shared/id';
import { useI18n, isMessageKey } from '../../shared/i18n/context';

export function FrameworkSettings({ settings }: { settings: Frameworks }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(settings.profiles[0]?.id ?? '');
  const profile = settings.profiles.find((item) => item.id === selected);
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
              setFresh(null);
            }}
          >
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
            setSelected('');
            setFresh({
              ...exampleFramework(),
              id: `framework-${newId()}`,
              name: '',
              frameworkSource: '',
              targetUrl: 'http://127.0.0.1:4320',
            });
          }}
        >
          {t('newFramework')}
        </button>
      </div>
      {settings.error && (
        <p className="wb-error" role="alert">
          {isMessageKey(settings.error) ? t(settings.error) : t('execution_invalid')}
        </p>
      )}
      {(fresh || profile) && (
        <FrameworkForm
          key={(fresh ?? profile)!.id}
          initial={(fresh ?? profile)!}
          save={(value) => {
            if (settings.save(value)) {
              setSelected(value.id);
              setFresh(null);
              return true;
            }
            return false;
          }}
        />
      )}
    </section>
  );
}
function FrameworkForm({
  initial,
  save,
}: {
  initial: FrameworkProfile;
  save: (value: FrameworkProfile) => boolean;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  function change(patch: Partial<FrameworkProfile>) {
    setValue((current) => ({ ...current, ...patch }));
    setSaved(false);
  }
  async function read(file?: File) {
    if (!file) return;
    try {
      if (file.size > 60000) throw new Error('too_large');
      change({ frameworkSource: await file.text() });
      setError(false);
    } catch {
      setError(true);
    }
  }
  return (
    <form
      className="settings-framework-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(save(value));
      }}
    >
      <div className="settings-fields">
        <label className="wb-field">
          {t('frameworkName')}
          <input
            className="workbench-input"
            required
            maxLength={200}
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
          className="workbench-textarea wb-code"
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
          accept=".py,text/x-python"
          onChange={(event) => {
            void read(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      <p className="wb-banner">{t('trustedFrameworkHint')}</p>
      {error && <p className="wb-error">{t('framework_read_failed')}</p>}
      <button className="workbench-btn wb-primary" type="submit">
        {t('saveFramework')}
      </button>
      {saved && <p role="status">{t('settingsSaved')}</p>}
    </form>
  );
}
