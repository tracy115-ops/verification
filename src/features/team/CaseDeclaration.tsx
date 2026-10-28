import { useEffect, useState } from 'react';
import type { SharedCase } from '../../domain/team/collaboration';
import { useI18n } from '../../shared/i18n/context';
import type { TeamActions } from './useTeam';

export function CaseDeclaration({ actions, item }: { actions: TeamActions; item: SharedCase }) {
  const { t } = useI18n();
  const project = actions.project!;
  const [covered, setCovered] = useState(false);
  const [note, setNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [baseline, setBaseline] = useState({
    projectRevision: project.revision,
    caseRevision: item.revision,
  });
  useEffect(() => {
    if (dirty) return;
    setCovered(!!item.declaration && item.declaration.caseRevision === item.revision);
    setNote(item.declaration?.note ?? '');
    setBaseline({ projectRevision: project.revision, caseRevision: item.revision });
  }, [dirty, project.revision, item]);
  async function save() {
    if (
      await actions.command(
        { type: 'declare_coverage', caseId: item.id, caseRevision: baseline.caseRevision, covered, note },
        baseline.projectRevision,
      )
    )
      setDirty(false);
  }
  return (
    <div>
      {dirty && project.revision !== baseline.projectRevision && (
        <p className="wb-banner">{t('team_conflict_draft')}</p>
      )}
      <label className="collab-check">
        <input
          type="checkbox"
          checked={covered}
          onChange={(event) => {
            setCovered(event.target.checked);
            setDirty(true);
          }}
        />
        {t('collab_declare')}
      </label>
      <label className="wb-field">
        {t('collab_reference')}
        <textarea
          aria-label={t('collab_reference')}
          className="workbench-textarea"
          value={note}
          maxLength={12000}
          onChange={(event) => {
            setNote(event.target.value);
            setDirty(true);
          }}
        />
      </label>
      <div className="collab-toolbar">
        <button
          className="workbench-btn"
          disabled={actions.busy || !dirty || (covered && !note.trim())}
          onClick={() => void save()}
        >
          {t('collab_save_declaration')}
        </button>
        {dirty && (
          <button className="workbench-btn" onClick={() => setDirty(false)}>
            {t('team_discard_draft')}
          </button>
        )}
      </div>
    </div>
  );
}
