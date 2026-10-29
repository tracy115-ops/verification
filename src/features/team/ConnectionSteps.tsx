import { useI18n } from '../../shared/i18n/context';

export function ConnectionSteps({
  step,
  back,
  canChangeServer = true,
}: {
  step: 1 | 2 | 3;
  back?: (step: 1 | 2) => void;
  canChangeServer?: boolean;
}) {
  const { t } = useI18n();
  return (
    <nav className="team-connect-steps" aria-label={t('teamConnectSteps')}>
      {(['teamConnectServer', 'teamConnectIdentity', 'teamConnectProject'] as const).map((key, index) => (
        <div
          key={key}
          className={index + 1 === step ? 'is-current' : index + 1 < step ? 'is-complete' : ''}
          aria-current={index + 1 === step ? 'step' : undefined}
        >
          {index + 1 < step && back && (index !== 0 || canChangeServer) ? (
            <button type="button" onClick={() => back((index + 1) as 1 | 2)}>
              <span>{index + 1}</span>
              <strong>{t(key)}</strong>
            </button>
          ) : (
            <>
              <span>{index + 1}</span>
              <strong>{t(key)}</strong>
            </>
          )}
        </div>
      ))}
    </nav>
  );
}
