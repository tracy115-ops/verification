import { useState } from 'react';
import type { TeamActions } from './useTeam';
import { analysisPrompt } from '../../domain/team/prompt';
import { isAnalysis } from '../../domain/team/schema';
import { checkAnalysis } from '../../domain/team/rules';
import { useI18n } from '../../shared/i18n/context';

export function AnalysisExchange({ actions }: { actions: TeamActions }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [revision, setRevision] = useState(actions.project!.revision);
  const [open, setOpen] = useState(false);
  const editable = ['admin', 'editor'].includes(actions.member?.role ?? '');
  async function importAnalysis() {
    try {
      const value: unknown = JSON.parse(text);
      if (!isAnalysis(value)) throw new Error('team_invalid');
      checkAnalysis(value, actions.project!);
      if (await actions.command({ type: 'replace_analysis', analysis: value }, revision)) {
        setText('');
        setOpen(false);
      }
    } catch (error) {
      actions.setError(error instanceof Error ? error.message : 'team_invalid');
    }
  }
  function exportProject() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(actions.project, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${actions.project!.id}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="team-exchange">
      <div className="team-actions">
        <button className="workbench-btn" onClick={exportProject}>
          {t('team_export')}
        </button>
        {editable && !actions.project!.factors.length && !actions.project!.scenarios.length && (
          <button
            className="workbench-btn"
            onClick={() => {
              setRevision(actions.project!.revision);
              setOpen((value) => !value);
            }}
          >
            {t('team_agent_exchange')}
          </button>
        )}
      </div>
      {open && (
        <div className="team-import">
          <p className="wb-muted">{t('team_agent_hint')}</p>
          <label className="wb-field">
            {t('team_analysis_prompt')}
            <textarea
              className="workbench-textarea wb-code"
              readOnly
              value={analysisPrompt(actions.project!)}
            />
          </label>
          <label className="wb-field">
            {t('team_analysis_json')}
            <textarea
              className="workbench-textarea wb-code"
              value={text}
              maxLength={800000}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <p className="wb-banner">{t('team_replace_warning')}</p>
          <button
            className="workbench-btn wb-primary"
            disabled={actions.busy || !text.trim()}
            onClick={() => void importAnalysis()}
          >
            {t('team_replace_analysis')}
          </button>
        </div>
      )}
    </section>
  );
}
