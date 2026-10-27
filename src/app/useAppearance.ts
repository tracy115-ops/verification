import { useEffect, useState } from 'react';
import type { Locale } from '../shared/i18n/messages';

function load(): { locale: Locale; dark: boolean } {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('verification-workbench.appearance.v1') ?? 'null');
    if (
      typeof value === 'object' &&
      value !== null &&
      'locale' in value &&
      'dark' in value &&
      typeof value.dark === 'boolean' &&
      (value.locale === 'zh-CN' || value.locale === 'en-US')
    )
      return { locale: value.locale, dark: value.dark };
  } catch {
    /* Invalid appearance preferences do not affect saved workflow data. */
  }
  return { locale: 'zh-CN', dark: false };
}

export function useAppearance() {
  const [initial] = useState(load);
  const [locale, setLocale] = useState<Locale>(initial.locale);
  const [dark, setDark] = useState(initial.dark);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('verification-workbench.appearance.v1', JSON.stringify({ locale, dark }));
    } catch {
      /* Appearance remains usable when browser storage is unavailable. */
    }
  }, [locale, dark]);
  return { locale, setLocale, dark, toggleTheme: () => setDark((current) => !current) };
}
