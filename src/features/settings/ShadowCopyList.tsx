import type { ShadowSnapshot } from '../../services/personal-shadow';
import { useI18n } from '../../shared/i18n/context';

export function ShadowCopyList({
  snapshots,
  selected,
  disabled,
  select,
}: {
  snapshots: ShadowSnapshot[];
  selected?: number;
  disabled: boolean;
  select: (id: number) => void;
}) {
  const { t, locale } = useI18n();
  const count = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <fieldset className="settings-shadow-list" disabled={disabled}>
      <legend>{t('shadowSelect')}</legend>
      {snapshots.map((copy) => (
        <label key={copy.id} className="settings-shadow-option">
          <input
            type="radio"
            name="shadow-copy"
            checked={copy.id === selected}
            value={copy.id}
            onChange={() => select(copy.id)}
          />
          <span>
            <strong>
              {t('shadowCopyLabel').replace('{id}', count.format(copy.id))} ·{' '}
              {date.format(new Date(copy.createdAt))}
            </strong>
            <small>
              {t('shadowRecords')}: {count.format(copy.sessions)} / {count.format(copy.transcripts)}
            </small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
