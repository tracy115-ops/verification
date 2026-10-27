import { Folder, ShieldCheck } from 'lucide-react';
import { useI18n } from '../shared/i18n/context';
import { navigation, type Page } from './navigation';

export function Sidebar({ page, setPage }: { page: Page; setPage: (page: Page) => void }) {
  const { t } = useI18n();
  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <span className="app-brand-mark">
          <ShieldCheck size={22} />
        </span>
        <div>
          <strong>{t('app')}</strong>
          <small>VERIFICATION</small>
        </div>
      </div>
      <div className="app-project">
        <Folder size={17} />
        <div>
          <strong>{t('project')}</strong>
          <small>{t('local')}</small>
        </div>
      </div>
      <nav aria-label={t('project')}>
        {navigation.map(({ page: item, icon: Icon, key }) => (
          <button
            key={item}
            aria-label={t(key)}
            className={`app-nav-item ${page === item ? 'is-active' : ''}`}
            onClick={() => setPage(item)}
            aria-current={page === item ? 'page' : undefined}
          >
            <Icon size={19} />
            <span>{t(key)}</span>
            {item === 'workflow' && <small>01</small>}
          </button>
        ))}
      </nav>
      <div className="app-sidebar-footer">
        <span className="app-environment-dot" />
        {t('phase')}
        <p>{t('scope')}</p>
      </div>
    </aside>
  );
}
