import { useState } from 'react';
import type { ExecutionPlan } from '../../domain/execution/types';
import { useI18n } from '../../shared/i18n/context';

export function ExecutionReview({
  plan,
  busy,
  approve,
}: {
  plan: ExecutionPlan;
  busy: boolean;
  approve: () => void;
}) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(false);
  return (
    <section className="session-execution-review">
      <h3>{t('executionReview')}</h3>
      <p className="wb-banner">{t('executionReviewHint')}</p>
      <dl>
        <dt>{t('targetUrl')}</dt>
        <dd>{plan.payload.profile.targetUrl}</dd>
        <dt>{t('pythonCommand')}</dt>
        <dd>
          {plan.payload.profile.pythonCommand} · {plan.pythonVersion}
        </dd>
        <dt>{t('executionTimeout')}</dt>
        <dd>{plan.payload.profile.timeoutSeconds}</dd>
        <dt>{t('scriptDigest')}</dt>
        <dd>{plan.scriptSha256}</dd>
        <dt>{t('frameworkDigest')}</dt>
        <dd>{plan.frameworkSha256}</dd>
        <dt>{t('planDigest')}</dt>
        <dd>{plan.digest}</dd>
      </dl>
      <details open>
        <summary>{t('scriptSource')}</summary>
        <pre>{plan.payload.implementation.script}</pre>
      </details>
      <details>
        <summary>{t('frameworkSource')}</summary>
        <pre>{plan.payload.profile.frameworkSource}</pre>
      </details>
      <details>
        <summary>{t('approvedTests')}</summary>
        <ul>
          {plan.payload.implementation.tests.map((item) => (
            <li key={item.testName}>
              <code>{item.testName}</code> → {item.caseIds.join(', ')}
            </li>
          ))}
        </ul>
      </details>
      <p className="wb-muted">{t('trustedFrameworkHint')}</p>
      <label className="session-execution-confirm">
        <input
          type="checkbox"
          checked={checked}
          disabled={busy}
          onChange={(event) => setChecked(event.target.checked)}
        />
        {t('confirmExecution')}
      </label>
      <button className="workbench-btn wb-primary wb-full" disabled={busy || !checked} onClick={approve}>
        {t('approveContinue')}
      </button>
    </section>
  );
}
