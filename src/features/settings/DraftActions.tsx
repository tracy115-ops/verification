import { useI18n } from '../../shared/i18n/context';

export function DraftActions({
  dirty,
  reset,
  conflicted = false,
  busy = false,
}: {
  dirty: boolean;
  reset: () => void;
  conflicted?: boolean;
  busy?: boolean;
}) {
  const { t } = useI18n();
  if (!dirty) return null;
  return (
    <div className="settings-draft-actions">
      <span className="wb-muted" role="status">
        {t(busy ? 'draftSaving' : conflicted ? 'draftConflict' : 'draftPending')}
      </span>
      <button className="workbench-btn wb-text" type="button" disabled={busy} onClick={reset}>
        {t('draftDiscard')}
      </button>
    </div>
  );
}
