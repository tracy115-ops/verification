import type { WorkflowRun } from '../../domain/runtime/types';
import type { OpenCaseEditor } from './case-editor-types';
import { useI18n } from '../../shared/i18n/context';

export function CaseEditActions({
  run,
  currentId,
  open,
}: {
  run: WorkflowRun;
  currentId?: string;
  open?: OpenCaseEditor;
}) {
  const { t } = useI18n();
  if (!open || ['ready', 'running'].includes(run.status)) return null;
  return (
    <>
      <button className="workbench-btn" onClick={() => open(run, undefined, 'add')}>
        {t('caseAdd')}
      </button>
      {currentId && (
        <>
          <button className="workbench-btn" onClick={() => open(run, currentId, 'edit')}>
            {t('caseEdit')}
          </button>
          <button className="workbench-btn" onClick={() => open(run, currentId, 'copy')}>
            {t('caseCopy')}
          </button>
        </>
      )}
    </>
  );
}
