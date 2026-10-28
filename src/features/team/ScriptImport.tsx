import { useState } from 'react';
import { collaboration } from '../../domain/team/collaboration';
import { isScriptInput } from '../../domain/team/collaboration-schema';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { ReviewDialog } from '../sessions/ReviewDialog';
import type { TeamActions } from './useTeam';
import { InlineTeamError } from './InlineTeamError';

export function ScriptImport({ actions, close }: { actions: TeamActions; close: () => void }) {
  const { t } = useI18n();
  const [baseline] = useState(structuredClone(actions.project!));
  const [source, setSource] = useState('');
  const [name, setName] = useState('test_cases.py');
  const [methods, setMethods] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState('');
  const cases = collaboration(baseline).cases;
  async function inspect() {
    setBusy(true);
    setError(null);
    setMethods([]);
    setMappings({});
    try {
      setMethods(await actions.api.inspectScript(source));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'team_invalid');
    } finally {
      setBusy(false);
    }
  }
  async function file(file?: File) {
    if (!file) return;
    if (file.size > 800000) {
      setError('team_too_large');
      return;
    }
    if (file.name.endsWith('.json')) {
      setManifest(await file.text());
      return;
    }
    if (file.size > 100000) {
      setError('team_too_large');
      return;
    }
    setManifest('');
    setSource(await file.text());
    setName(file.name);
    setMethods([]);
    setMappings({});
  }
  async function save() {
    try {
      const script: unknown = manifest.trim()
        ? JSON.parse(manifest)
        : {
            version: 1,
            name,
            source,
            mappings: Object.entries(mappings)
              .filter(([, names]) => names.length)
              .map(([caseId, testNames]) => ({
                caseId,
                testNames,
                caseRevision: cases.find((item) => item.id === caseId)!.revision,
              })),
          };
      if (!isScriptInput(script)) throw new Error('team_invalid');
      if (await actions.uploadScript(script, baseline.revision)) close();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'team_invalid');
    }
  }
  return (
    <ReviewDialog open close={close} title="collab_script_import">
      <div className="collab-form">
        <p>{t('collab_coverage_hint')}</p>
        <InlineTeamError code={actions.error} />
        {actions.project!.revision !== baseline.revision && (
          <p className="wb-banner">{t('team_conflict_draft')}</p>
        )}
        {error && (
          <p role="alert" className="wb-error">
            {isMessageKey(error) ? t(error) : t('team_invalid')}
          </p>
        )}
        <label className="wb-field">
          {t('collab_script_file')}
          <input
            type="file"
            accept=".py,.json,text/x-python,application/json"
            disabled={busy}
            onChange={(event) => void file(event.target.files?.[0]).catch(() => setError('team_invalid'))}
          />
        </label>
        <label className="wb-field">
          {t('collab_script_name')}
          <input
            className="workbench-input"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="wb-field">
          {t('collab_script_source')}
          <textarea
            className="workbench-textarea wb-code"
            maxLength={100000}
            value={source}
            disabled={busy}
            onChange={(event) => {
              setSource(event.target.value);
              setMethods([]);
              setMappings({});
            }}
          />
        </label>
        <button className="workbench-btn" disabled={busy || !source.trim()} onClick={() => void inspect()}>
          {t('collab_inspect')}
        </button>
        {!methods.length ? (
          <p className="wb-muted">{t('collab_no_methods')}</p>
        ) : (
          <div className="collab-method-map">
            {cases.map((item) => (
              <label className="wb-field" key={item.id}>
                <strong>
                  {item.id} · {item.title} · r{item.revision}
                </strong>
                <span>{t('collab_test_methods')}</span>
                <select
                  multiple
                  className="workbench-select"
                  aria-label={`${item.id} ${t('collab_test_methods')}`}
                  value={mappings[item.id] ?? []}
                  onChange={(event) =>
                    setMappings({
                      ...mappings,
                      [item.id]: Array.from(event.target.selectedOptions, (option) => option.value),
                    })
                  }
                >
                  {methods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        <details>
          <summary>{t('collab_json')}</summary>
          <p className="wb-muted">{t('collab_result_source')}</p>
          <textarea
            className="workbench-textarea wb-code"
            aria-label={t('collab_json')}
            maxLength={800000}
            value={manifest}
            onChange={(event) => setManifest(event.target.value)}
          />
        </details>
        <button
          className="workbench-btn wb-primary"
          disabled={
            busy ||
            actions.busy ||
            (!manifest.trim() && !Object.values(mappings).some((names) => names.length))
          }
          onClick={() => void save()}
        >
          {t('collab_publish_script')}
        </button>
      </div>
    </ReviewDialog>
  );
}
