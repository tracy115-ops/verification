import { I18nContext } from '../shared/i18n/context';
import { useAppearance } from './useAppearance';
import { Workbench } from './Workbench';

export function App() {
  const appearance = useAppearance();
  return (
    <I18nContext.Provider value={appearance.locale}>
      <Workbench appearance={appearance} />
    </I18nContext.Provider>
  );
}
