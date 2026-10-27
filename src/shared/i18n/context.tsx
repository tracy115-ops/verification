import { createContext, useCallback, useContext } from 'react';
import { en, zh, type Locale, type MessageKey } from './messages';

export const I18nContext = createContext<Locale>('zh-CN');
export function useI18n() {
  const locale = useContext(I18nContext);
  const t = useCallback((key: MessageKey): string => (locale === 'zh-CN' ? zh[key] : en[key]), [locale]);
  return { locale, t };
}

export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(zh, key);
}
