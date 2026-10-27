import { useState } from 'react';
import { ArrowLeftRight, Check, FileText, GitBranch, Plus } from 'lucide-react';
import { coverageState, type CoverageState } from '../../domain/coverage';
import { useI18n } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';

const scenarios = ['第 1–4 次失败不锁定', '第 5 次失败触发锁定', '10 分钟窗口边界', '15 分钟后解除锁定'];
const source = '同一账号在 10 分钟内连续失败 5 次后锁定 15 分钟。锁定期间拒绝登录。';
const labels = {
  missing: 'uncovered',
  candidate: 'candidate',
  confirmed: 'confirmed',
  unassessed: 'notReady',
} as const;
const tones = {
  missing: 'danger',
  candidate: 'warning',
  confirmed: 'success',
  unassessed: 'neutral',
} as const;

export function ReviewWorkspace() {
  const { t } = useI18n();
  const [selected, setSelected] = useState(2);
  const [states, setStates] = useState<CoverageState[]>(['confirmed', 'confirmed', 'missing', 'candidate']);
  const overall = coverageState(states);
  function advance() {
    setStates((current) =>
      current.map((state, index) =>
        index === selected ? (state === 'missing' ? 'candidate' : 'confirmed') : state,
      ),
    );
  }
  return (
    <section className="review-shell">
      <div className="wb-banner">
        <strong>{t('demo')}</strong> · {t('demoHint')}
      </div>
      <div className="review-status-strip">
        <span>
          {t('coverage')} <Status tone={tones[overall]}>{t(labels[overall])}</Status>
        </span>
        <span>
          {t('readiness')} <Status>{t('notReady')}</Status>
        </span>
        <span>
          {t('execution')} <Status>{t('notRun')}</Status>
        </span>
      </div>
      <div className="review-columns">
        <section className="review-pane">
          <div className="wb-panel-heading">
            <h2>
              <FileText size={16} />
              {t('source')}
            </h2>
            <code>SPEC@r1</code>
          </div>
          <div className="review-document">
            <small>security-spec.md · L12–14</small>
            <h3>账号登录与锁定</h3>
            <p className="review-quote">{source}</p>
            <code>REQ-LOGIN-007@r1</code>
            <p className="wb-muted">{t('evidence')}</p>
          </div>
        </section>
        <section className="review-pane">
          <div className="wb-panel-heading">
            <h2>
              <GitBranch size={16} />
              {t('scenarios')}
            </h2>
            <span>4</span>
          </div>
          <div className="review-tree">
            <h3>REQ-LOGIN-007</h3>
            {scenarios.map((scenario, index) => (
              <button
                key={scenario}
                className={`review-tree-item ${selected === index ? 'is-selected' : ''}`}
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              >
                <span className="review-tree-line">
                  <GitBranch size={14} />
                  <strong>{scenario}</strong>
                </span>
                <Status tone={tones[states[index]]}>{t(labels[states[index]])}</Status>
              </button>
            ))}
          </div>
        </section>
        <section className="review-pane">
          <div className="wb-panel-heading">
            <h2>
              <ArrowLeftRight size={16} />
              {t('inspector')}
            </h2>
          </div>
          <div className="review-inspector">
            <Status tone={tones[states[selected]]}>{t(labels[states[selected]])}</Status>
            <h3>{scenarios[selected]}</h3>
            <code>REQ-LOGIN-007 → {states[selected] === 'missing' ? '—' : `SCN-00${selected + 1}`}</code>
            <p className="review-quote">{source}</p>
            {states[selected] !== 'confirmed' && (
              <button className="workbench-btn wb-primary wb-full" onClick={advance}>
                {states[selected] === 'missing' ? <Plus size={15} /> : <Check size={15} />}
                {t(states[selected] === 'missing' ? 'generateSuggestion' : 'confirmMapping')}
              </button>
            )}
            <p className="wb-muted">{t('evidence')}</p>
          </div>
        </section>
      </div>
    </section>
  );
}
