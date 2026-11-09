import { useState } from 'react';
import { Copy, Library, Plus, Trash2 } from 'lucide-react';
import type { useWorkbench } from '../../app/useWorkbench';
import { useI18n } from '../../shared/i18n/context';
import { ConfirmDialog } from '../settings/ConfirmDialog';

export function WorkflowLibrary({ workbench }: { workbench: ReturnType<typeof useWorkbench> }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'list' | 'new' | 'copy' | 'rename' | 'delete'>('list');
  const [name, setName] = useState('');
  const items = workbench.library.filter((item) =>
    `${item.definition.name} ${item.definition.id}`
      .toLocaleLowerCase(locale)
      .includes(query.toLocaleLowerCase(locale)),
  );
  function close() {
    setOpen(false);
    setMode('list');
    setName('');
  }
  return (
    <>
      <button className="workbench-btn" onClick={() => setOpen(true)}>
        <Library size={15} />
        {t('workflowLibrary')}
      </button>
      {open && (
        <ConfirmDialog title={t('workflowLibrary')} busy={false} onCancel={close}>
          <div className="workflow-library">
            <h2>{t('workflowLibrary')}</h2>
            <p className="wb-muted">{t('workflowLibraryHint')}</p>
            {workbench.dirty && (
              <div className="wb-banner" role="status">
                <p>{t('workflowDirtyGuard')}</p>
                <button className="workbench-btn" onClick={workbench.save}>
                  {t('save')}
                </button>{' '}
                <button className="workbench-btn wb-text" onClick={workbench.discardWorkflowChanges}>
                  {t('workflowDiscard')}
                </button>
              </div>
            )}
            <div className="workflow-library-actions">
              <button
                className="workbench-btn wb-primary"
                disabled={workbench.dirty}
                onClick={() => {
                  setMode('new');
                  setName('');
                }}
              >
                <Plus size={15} />
                {t('workflowCreate')}
              </button>
              <button
                className="workbench-btn"
                disabled={workbench.dirty}
                onClick={() => {
                  setMode('copy');
                  setName(workbench.document.definition.name);
                }}
              >
                <Copy size={15} />
                {t('workflowDuplicate')}
              </button>
              <button
                className="workbench-btn"
                disabled={workbench.dirty}
                onClick={() => {
                  setMode('rename');
                  setName(workbench.document.definition.name);
                }}
              >
                {t('workflowRename')}
              </button>
              <button
                className="workbench-btn wb-text"
                disabled={workbench.dirty || !workbench.savedDocument}
                onClick={() => setMode('delete')}
              >
                <Trash2 size={15} />
                {t('workflowDelete')}
              </button>
            </div>
            {(mode === 'new' || mode === 'copy' || mode === 'rename') && (
              <form
                className="workflow-library-create"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    mode === 'rename'
                      ? workbench.renameWorkflow(name)
                      : workbench.createWorkflow(name, mode === 'copy')
                  )
                    close();
                }}
              >
                {mode !== 'rename' && <p className="wb-muted">{t('workflowCreateHint')}</p>}
                <label className="wb-field">
                  {t(mode === 'rename' ? 'workflowName' : 'workflowCreateName')}
                  <input
                    autoFocus
                    required
                    maxLength={200}
                    className="workbench-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <button className="workbench-btn wb-primary" disabled={!name.trim() || workbench.dirty}>
                  {t(mode === 'rename' ? 'save' : 'workflowCreateConfirm')}
                </button>
              </form>
            )}
            {mode === 'delete' && (
              <div className="workflow-library-create">
                <strong>{workbench.document.definition.name}</strong>
                <p>{t('workflowDeleteHint')}</p>
                <button
                  className="workbench-btn"
                  disabled={workbench.dirty}
                  onClick={() => {
                    if (workbench.deleteWorkflow(workbench.document.definition.id)) setMode('list');
                  }}
                >
                  {t('workflowDeleteConfirm')}
                </button>
              </div>
            )}
            <input
              className="workbench-input"
              aria-label={t('workflowSearch')}
              placeholder={t('workflowSearch')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <ul className="workflow-library-list">
              {items.map((item) => (
                <li key={item.definition.id}>
                  <button
                    className="workbench-btn"
                    disabled={workbench.dirty}
                    aria-current={
                      item.definition.id === workbench.document.definition.id ? 'true' : undefined
                    }
                    onClick={() => {
                      if (workbench.selectWorkflow(item.definition.id)) close();
                    }}
                  >
                    <strong>{item.definition.name}</strong>
                    <small className="wb-muted">
                      v{item.definition.version} · r{new Intl.NumberFormat(locale).format(item.revision)}
                    </small>
                    <small className="wb-muted">{item.definition.id}</small>
                  </button>
                </li>
              ))}
            </ul>
            {!items.length && (
              <p className="wb-muted">
                {t(workbench.library.length ? 'assetNoMatches' : 'workflowLibraryEmpty')}
              </p>
            )}
            <div className="modal-actions">
              <button className="workbench-btn" onClick={close}>
                {t('workflowClose')}
              </button>
            </div>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
