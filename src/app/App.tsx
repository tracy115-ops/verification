import { DraftProvider } from '../shared/drafts/context';
import { I18nContext } from '../shared/i18n/context';
import { useAppearance } from './useAppearance';
import { Workbench } from './Workbench';
import { ConversationStorageGate } from './ConversationStorageGate';

export function App() {
  const appearance = useAppearance();
  return (
    <I18nContext.Provider value={appearance.locale}>
      <ConversationStorageGate>
        <DraftProvider>
          <Workbench appearance={appearance} />
        </DraftProvider>
      </ConversationStorageGate>
    </I18nContext.Provider>
  );
}
