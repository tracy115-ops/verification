import { useState } from 'react';
import type { DesignArtifact, WorkflowRun } from '../../domain/runtime/types';
import { isRequirements } from '../../domain/runtime/artifacts';
import { latestArtifact } from '../../domain/runtime/bindings';
import { reviseDesign } from '../../domain/runtime/design-revision';
import { useI18n } from '../../shared/i18n/context';
import { ReviewDialog } from '../sessions/ReviewDialog';
import type { UpdateRun } from './PersonalCaseCoverage';
import type { MessageKey } from '../../shared/i18n/messages';

type Kind = 'factors' | 'scenarios';
export function DesignEditActions({
  run,
  value,
  kind,
  currentId,
  updateRun,
}: {
  run: WorkflowRun;
  value: DesignArtifact;
  kind: Kind;
  currentId?: string;
  updateRun?: UpdateRun;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  if (!updateRun || ['ready', 'running'].includes(run.status)) return null;
  return (
    <>
      <button className="workbench-btn" onClick={() => setEditing('')}>
        {t('designAdd')}
      </button>
      {currentId && (
        <button className="workbench-btn" onClick={() => setEditing(currentId)}>
          {t('designEdit')}
        </button>
      )}
      <ReviewDialog
        open={editing !== null}
        close={() => setEditing(null)}
        title="designEditor"
        closeLabel="designClose"
      >
        {editing !== null && (
          <DesignForm
            key={`${kind}:${editing}`}
            run={run}
            value={value}
            kind={kind}
            currentId={editing}
            updateRun={updateRun}
            close={() => setEditing(null)}
          />
        )}
      </ReviewDialog>
    </>
  );
}

function DesignForm({
  run,
  value,
  kind,
  currentId,
  updateRun,
  close,
}: {
  run: WorkflowRun;
  value: DesignArtifact;
  kind: Kind;
  currentId: string;
  updateRun: UpdateRun;
  close: () => void;
}) {
  const { t } = useI18n();
  const factor = kind === 'factors' ? value.factors?.find((item) => item.id === currentId) : undefined;
  const scenario = kind === 'scenarios' ? value.scenarios.find((item) => item.id === currentId) : undefined;
  const [id, setId] = useState(
    currentId || `${kind === 'factors' ? 'F' : 'S'}_${crypto.randomUUID().slice(0, 8)}`,
  );
  const [name, setName] = useState(factor?.name ?? scenario?.title ?? '');
  const [ids, setIds] = useState(factor?.requirementIds ?? scenario?.requirementIds ?? []);
  const [levels, setLevels] = useState(factor?.levels.join('\n') ?? '');
  const [quote, setQuote] = useState(factor?.sourceQuote ?? '');
  const [dimension, setDimension] = useState(scenario?.dimension ?? '');
  const [expected, setExpected] = useState(scenario?.expected ?? '');
  const [links, setLinks] = useState(scenario?.factorLevels ?? []);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const baseline = latestArtifact(run, 'RequirementBaseline');
  const requirements = isRequirements(baseline) ? baseline.requirements : [];
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(false);
    setBusy(true);
    try {
      const next = structuredClone(value);
      const items = kind === 'factors' ? (next.factors ?? []) : next.scenarios;
      if (!currentId && items.some((item) => item.id === id)) throw new Error('artifact_invalid');
      if (kind === 'factors') {
        const item = {
          id,
          name: name.trim(),
          requirementIds: ids,
          levels: levels
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          sourceQuote: quote,
        };
        next.factors = currentId
          ? (next.factors ?? []).map((old) => (old.id === currentId ? item : old))
          : [...(next.factors ?? []), item];
      } else {
        const item = {
          id,
          title: name.trim(),
          requirementIds: ids,
          dimension: dimension.trim(),
          expected: expected.trim(),
          factorLevels: links,
        };
        next.scenarios = currentId
          ? next.scenarios.map((old) => (old.id === currentId ? item : old))
          : [...next.scenarios, item];
      }
      updateRun(run.sessionId, await reviseDesign(run, next, reason));
      close();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="collab-form design-edit-form" onSubmit={(event) => void save(event)}>
      <p className="wb-muted">{t('designRevisionHint')}</p>
      {error && <p role="alert">{t('designInvalid')}</p>}
      <label className="wb-field">
        ID
        <input
          className="workbench-input"
          required
          pattern="[A-Za-z][A-Za-z0-9_-]{0,79}"
          value={id}
          disabled={!!currentId}
          onChange={(e) => setId(e.target.value)}
        />
      </label>
      <TextField label="designName" value={name} change={setName} />
      <fieldset>
        <legend>{t('designRequirements')}</legend>
        {requirements.map((item) => (
          <label className="collab-check" key={item.id}>
            <input
              type="checkbox"
              checked={ids.includes(item.id)}
              onChange={(e) =>
                setIds(e.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))
              }
            />
            {item.id} · {item.text}
          </label>
        ))}
      </fieldset>
      {kind === 'factors' ? (
        <>
          <TextField label="designLevels" value={levels} change={setLevels} />
          <TextField label="designQuote" value={quote} change={setQuote} />
          {requirements
            .filter((item) => ids.includes(item.id))
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className="workbench-btn wb-text"
                onClick={() => setQuote(item.quote)}
              >
                {t('designQuote')} · {item.id}
              </button>
            ))}
        </>
      ) : (
        <>
          <TextField label="designDimension" value={dimension} change={setDimension} />
          <TextField label="designExpected" value={expected} change={setExpected} />
          {(value.factors ?? []).map((item) => (
            <label key={item.id} className="wb-field">
              {item.id} · {item.name}
              <select
                aria-label={`${item.id} · ${item.name}`}
                className="workbench-select"
                value={links.find((link) => link.factorId === item.id)?.level ?? ''}
                onChange={(e) =>
                  setLinks([
                    ...links.filter((link) => link.factorId !== item.id),
                    ...(e.target.value ? [{ factorId: item.id, level: e.target.value }] : []),
                  ])
                }
              >
                <option value="">{t('designNoLevel')}</option>
                {item.levels.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
          ))}
        </>
      )}
      <TextField label="designReason" value={reason} change={setReason} />
      <button className="workbench-btn wb-primary" disabled={busy || !ids.length || !updateRun}>
        {t('designSave')}
      </button>
    </form>
  );
}

function TextField({
  label,
  value,
  change,
}: {
  label: MessageKey;
  value: string;
  change: (value: string) => void;
}) {
  const { t } = useI18n();
  const singleLine = label === 'designName' || label === 'designDimension';
  return (
    <label className="wb-field">
      {t(label)}
      {singleLine ? (
        <input
          required
          className="workbench-input"
          maxLength={12000}
          value={value}
          onChange={(e) => change(e.target.value)}
        />
      ) : (
        <textarea
          required
          className="workbench-textarea"
          maxLength={12000}
          value={value}
          onChange={(e) => change(e.target.value)}
        />
      )}
    </label>
  );
}
