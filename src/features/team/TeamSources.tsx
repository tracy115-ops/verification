import type { TeamActions } from './useTeam';
import { useI18n } from '../../shared/i18n/context';
import { AnalysisExchange } from './AnalysisExchange';

export function TeamSources({
  actions,
  generated,
  contribute,
}: {
  actions: TeamActions;
  generated: () => void;
  contribute: () => void;
}) {
  const { t } = useI18n();
  const project = actions.project!;
  const empty = !project.factors.length && !project.scenarios.length;
  return (
    <section className="team-step-content">
      <header className="team-step-content-heading">
        <div>
          <h2>{t('team_topic_interfaces')}</h2>
          <p className="wb-muted">{t('team_design_only')}</p>
        </div>
        <AnalysisExchange actions={actions} />
      </header>
      <div className="team-source-document">
        <pre>{project.topic}</pre>
        {project.interfaces.map((item) => (
          <article key={item.id}>
            <h3>
              {item.id} · {item.name}
            </h3>
            <pre>{item.contract || t('team_contract_unknown')}</pre>
          </article>
        ))}
      </div>
      {!!project.questions.length && (
        <details className="team-questions">
          <summary>
            {t('team_questions')} · {project.questions.length}
          </summary>
          <ul>
            {project.questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="team-actions">
        {['admin', 'editor'].includes(actions.member!.role) && empty && (
          <button
            className="workbench-btn"
            disabled={actions.busy}
            onClick={async () => {
              if (await actions.command({ type: 'suggest' })) generated();
            }}
          >
            {t('team_suggest')}
          </button>
        )}
        <button className="workbench-btn" onClick={contribute}>
          {t('teamImportExisting')}
        </button>
      </div>
      {empty && <p className="wb-muted">{t('team_rule_suggestions')}</p>}
    </section>
  );
}
