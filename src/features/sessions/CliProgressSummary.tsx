import type { CliProgress } from '../../domain/runtime/cli-progress';
import { progressPhase } from '../../domain/runtime/cli-progress';
import { useI18n } from '../../shared/i18n/context';

export function CliProgressSummary({
  progress,
  timeoutSeconds,
  hasReply = false,
  finished = false,
}: {
  progress?: CliProgress;
  timeoutSeconds?: number;
  hasReply?: boolean;
  finished?: boolean;
}) {
  const { t, locale } = useI18n();
  if (!progress) return null;
  const seconds = (ms: number) => new Intl.NumberFormat(locale).format(Math.floor(ms / 1000));
  return (
    <details className="session-cli-progress wb-muted">
      <summary>
        {t(finished ? 'cliProgressLast' : 'cliProgressCurrent')} ·{' '}
        {t('cliProgressElapsed').replace('{seconds}', seconds(progress.elapsedMs))} ·{' '}
        {t(hasReply ? 'cliProgressReply' : progressPhase(progress))}
      </summary>
      <p>
        {progress.lastOutputAgeMs === null
          ? t('cliProgressNoOutput')
          : t('cliProgressSilent').replace('{seconds}', seconds(progress.lastOutputAgeMs))}
        {timeoutSeconds !== undefined &&
          ` · ${t('cliProgressDeadline').replace('{seconds}', new Intl.NumberFormat(locale).format(timeoutSeconds))}`}
      </p>
      <p>{t('cliProgressEvidence')}</p>
    </details>
  );
}
