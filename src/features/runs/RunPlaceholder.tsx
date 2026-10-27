import { Play } from 'lucide-react';
import { useI18n } from '../../shared/i18n/context';

export function RunPlaceholder() {
  const { t } = useI18n();
  return <section className="run-empty"><span className="wb-icon-tile"><Play size={26} /></span>
    <h2>{t('runTitle')}</h2><p>{t('runHint')}</p><p>{t('runBoundary')}</p><strong>{t('next')}</strong></section>;
}
