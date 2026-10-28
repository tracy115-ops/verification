import { isDesign } from '../../domain/runtime/artifacts';
import { useI18n } from '../../shared/i18n/context';

export function FactorList({
  value,
  query,
  setQuery,
  selected,
  setSelected,
  navigate,
}: {
  value: unknown;
  query: string;
  setQuery: (value: string) => void;
  selected: string;
  setSelected: (value: string) => void;
  navigate: (kind: 'requirements' | 'scenarios', id: string) => void;
}) {
  const { t } = useI18n();
  const factors = isDesign(value) ? (value.factors ?? []) : [];
  const filtered = factors.filter((item) =>
    JSON.stringify(item).toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const current = filtered.find((item) => item.id === selected) ?? filtered[0];
  return (
    <div className="assets-body">
      <div className="assets-list">
        <div className="assets-list-heading">
          <strong>
            {t('factorItems')} · {filtered.length} / {factors.length}
          </strong>
        </div>
        <input
          className="workbench-input"
          aria-label={t('assetSearch')}
          placeholder={t('assetSearch')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {!filtered.length && <p className="wb-muted">{t(factors.length ? 'assetNoMatches' : 'noFactors')}</p>}
        {filtered.map((item) => (
          <button
            key={item.id}
            className={`assets-item ${current?.id === item.id ? 'is-selected' : ''}`}
            onClick={() => setSelected(item.id)}
          >
            <code>{item.id}</code>
            <span>{item.name}</span>
          </button>
        ))}
      </div>
      <div className="assets-detail">
        {current ? (
          <section className="session-artifact">
            <code>{current.id}</code>
            <h3>{current.name}</h3>
            <p>
              {t('relatedRequirements')}:{' '}
              {current.requirementIds.map((id) => (
                <button
                  key={id}
                  className="workbench-btn wb-text"
                  onClick={() => navigate('requirements', id)}
                >
                  {id}
                </button>
              ))}
            </p>
            <p>{t('factorLevels')}</p>
            <ul>
              {current.levels.map((level) => (
                <li key={level}>{level}</li>
              ))}
            </ul>
            <p>{t('requirementItems')}</p>
            <blockquote>{current.sourceQuote}</blockquote>
            {isDesign(value) &&
              value.scenarios
                .filter((item) => item.factorLevels?.some((link) => link.factorId === current.id))
                .map((item) => (
                  <button
                    key={item.id}
                    className="workbench-btn wb-text"
                    onClick={() => navigate('scenarios', item.id)}
                  >
                    {item.id} · {item.title}
                  </button>
                ))}
          </section>
        ) : (
          <p className="wb-muted">{t('assetSelectItem')}</p>
        )}
      </div>
    </div>
  );
}
