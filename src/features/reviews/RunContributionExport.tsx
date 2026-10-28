import type { WorkflowRun } from '../../domain/runtime/types';
import { runContribution, runScriptContribution } from '../../domain/team/run-contribution';
import { useI18n } from '../../shared/i18n/context';
import { downloadText } from '../team/download';

export function RunContributionExport({ run }: { run: WorkflowRun }) {
  const { t } = useI18n();
  const bundle = runContribution(run);
  const script = runScriptContribution(run);
  if (!bundle) return null;
  return (
    <div className="collab-toolbar">
      <button
        className="workbench-btn"
        onClick={() => downloadText(`contribution-${run.id}.json`, JSON.stringify(bundle, null, 2))}
      >
        {t('collab_export_run')}
      </button>
      {script && (
        <button
          className="workbench-btn"
          onClick={() => downloadText(`script-mapping-${run.id}.json`, JSON.stringify(script, null, 2))}
        >
          {t('collab_export_script')}
        </button>
      )}
    </div>
  );
}
