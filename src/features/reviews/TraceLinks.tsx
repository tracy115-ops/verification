import type { WorkflowRun } from '../../domain/runtime/types';
import { isCases, isDesign } from '../../domain/runtime/artifacts';
import { useI18n } from '../../shared/i18n/context';

export function TraceLinks({
  run,
  view,
  id,
  navigate,
}: {
  run: WorkflowRun;
  view: string;
  id: string;
  navigate: (kind: 'scenarios' | 'cases', id: string) => void;
}) {
  const { t } = useI18n();
  const artifacts = Object.values(run.artifacts);
  const design =
    artifacts.find((item) => item.type === 'TestDesign') ??
    artifacts.find((item) => item.type === 'TestDesignDraft');
  const cases =
    artifacts.find((item) => item.type === 'TestCaseSet') ??
    artifacts.find((item) => item.type === 'TestCaseSetDraft');
  const scenarios =
    view === 'requirements' && isDesign(design?.value)
      ? design.value.scenarios.filter((item) => item.requirementIds.includes(id))
      : [];
  const linkedCases = isCases(cases?.value)
    ? cases.value.cases.filter((item) =>
        view === 'requirements'
          ? item.requirementIds.includes(id)
          : view === 'scenarios' && item.scenarioIds.includes(id),
      )
    : [];
  if (!scenarios.length && !linkedCases.length) return null;
  return (
    <section className="session-artifact">
      <h3>{t('assetTrace')}</h3>
      {scenarios.map((item) => (
        <button
          key={item.id}
          className="workbench-btn wb-text"
          onClick={() => navigate('scenarios', item.id)}
        >
          {item.id} · {item.title}
        </button>
      ))}
      {linkedCases.map((item) => (
        <button key={item.id} className="workbench-btn wb-text" onClick={() => navigate('cases', item.id)}>
          {item.id} · {item.title}
        </button>
      ))}
    </section>
  );
}
