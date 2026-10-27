import { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { useI18n } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';

const cases = [
  {
    id: 'TC-001',
    name: '失败次数未到阈值',
    steps: '同一账号连续提交 4 次错误密码。',
    expected: '账号未锁定；锁定状态为 false。',
  },
  {
    id: 'TC-002',
    name: '第 5 次失败触发锁定',
    steps: '在 10 分钟内，同一账号连续提交 5 次错误密码。',
    expected: '账号进入锁定状态；正确密码在锁定期间仍被拒绝。',
  },
];

export function CaseReview() {
  const { t } = useI18n();
  const [confirmed, setConfirmed] = useState(false);
  return (
    <section className="case-shell">
      <div className="wb-banner">
        <strong>{t('demo')}</strong> · {t('caseHint')}
      </div>
      <div className="wb-section-heading">
        <h2>{t('caseTitle')}</h2>
        <button className="workbench-btn wb-primary" disabled={confirmed} onClick={() => setConfirmed(true)}>
          <CheckCheck size={16} />
          {t('confirmCases')}
        </button>
      </div>
      {cases.map((item) => (
        <article key={item.id} className="case-item">
          <div className="wb-section-heading">
            <div>
              <code>{item.id}</code>
              <h3>{item.name}</h3>
            </div>
            <Status tone={confirmed ? 'success' : 'warning'}>
              {t(confirmed ? 'casesConfirmed' : 'caseDraft')}
            </Status>
          </div>
          <div className="case-detail-grid">
            <div>
              <small>{t('steps')}</small>
              <p>{item.steps}</p>
            </div>
            <div>
              <small>{t('expected')}</small>
              <p>{item.expected}</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
