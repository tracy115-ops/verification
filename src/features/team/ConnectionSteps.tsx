import { useI18n } from '../../shared/i18n/context';

export function ConnectionSteps({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useI18n();
  return (
    <nav className="team-connect-steps" aria-label={t('teamConnectSteps')}>
      {(['teamConnectServer', 'teamConnectIdentity', 'teamConnectProject'] as const).map((key, index) => (
        <div
          key={key}
          className={index + 1 === step ? 'is-current' : index + 1 < step ? 'is-complete' : ''}
          aria-current={index + 1 === step ? 'step' : undefined}
        >
          <span>{index + 1}</span>
          <strong>{t(key)}</strong>
        </div>
      ))}
    </nav>
  );
}
