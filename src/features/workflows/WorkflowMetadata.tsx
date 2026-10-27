import type { WorkbenchDocument } from '../../domain/workflow';
import { useI18n } from '../../shared/i18n/context';

export function WorkflowMetadata({
  document,
  update,
}: {
  document: WorkbenchDocument;
  update: (value: WorkbenchDocument) => void;
}) {
  const { t } = useI18n();
  return (
    <details className="workflow-metadata">
      <summary>{t('workflowSettings')}</summary>
      <div>
        <label className="wb-field">
          {t('workflowName')}
          <input
            className="workbench-input"
            value={document.definition.name}
            onChange={(event) =>
              update({ ...document, definition: { ...document.definition, name: event.target.value } })
            }
          />
        </label>
        <label className="wb-field">
          {t('deadline')}
          <input
            type="number"
            min={1}
            max={86400}
            className="workbench-input"
            value={document.definition.limits.deadlineSeconds}
            onChange={(event) =>
              update({
                ...document,
                definition: {
                  ...document.definition,
                  limits: { ...document.definition.limits, deadlineSeconds: Number(event.target.value) },
                },
              })
            }
          />
        </label>
      </div>
    </details>
  );
}
