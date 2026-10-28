import { Bot, Languages, Moon, Sun } from 'lucide-react';
import type { AgentProfile } from '../../domain/workflow';
import type { Locale, MessageKey } from '../../shared/i18n/messages';
import { useI18n } from '../../shared/i18n/context';
import { AgentSettings } from '../agents/AgentSettings';
import { FrameworkSettings } from './FrameworkSettings';
import type { Frameworks } from '../../app/useFrameworks';

export type SettingsTab = 'general' | 'agents' | 'frameworks';
export interface Appearance {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dark: boolean;
  toggleTheme: () => void;
}
export function SettingsPage({
  profiles,
  addProfile,
  notify,
  tab,
  setTab,
  appearance,
  frameworks,
}: {
  profiles: AgentProfile[];
  addProfile: (profile: AgentProfile) => void;
  notify: (key: MessageKey) => void;
  tab: SettingsTab;
  setTab: (tab: SettingsTab) => void;
  appearance: Appearance;
  frameworks: Frameworks;
}) {
  const { t } = useI18n();
  return (
    <div className="settings-page">
      <nav className="settings-tabs" aria-label={t('settings')}>
        <button className="workbench-btn" aria-pressed={tab === 'general'} onClick={() => setTab('general')}>
          <Languages size={15} />
          {t('generalSettings')}
        </button>
        <button className="workbench-btn" aria-pressed={tab === 'agents'} onClick={() => setTab('agents')}>
          <Bot size={15} />
          {t('agents')}
        </button>
        <button
          className="workbench-btn"
          aria-pressed={tab === 'frameworks'}
          onClick={() => setTab('frameworks')}
        >
          {t('frameworkSettings')}
        </button>
      </nav>
      {tab === 'frameworks' ? (
        <FrameworkSettings settings={frameworks} />
      ) : tab === 'agents' ? (
        <AgentSettings profiles={profiles} addProfile={addProfile} notify={notify} />
      ) : (
        <section className="settings-general">
          <h2>{t('generalSettings')}</h2>
          <p className="wb-muted">{t('preferencesHint')}</p>
          <label className="wb-field">
            {t('language')}
            <select
              className="workbench-select"
              value={appearance.locale}
              onChange={(event) => appearance.setLocale(event.target.value === 'en-US' ? 'en-US' : 'zh-CN')}
            >
              <option value="zh-CN">中文</option>
              <option value="en-US">English</option>
            </select>
          </label>
          <div className="wb-field">
            <span>{t('theme')}</span>
            <div className="settings-theme-options">
              <button
                className="workbench-btn"
                aria-pressed={!appearance.dark}
                onClick={() => {
                  if (appearance.dark) appearance.toggleTheme();
                }}
              >
                <Sun size={16} />
                {t('light')}
              </button>
              <button
                className="workbench-btn"
                aria-pressed={appearance.dark}
                onClick={() => {
                  if (!appearance.dark) appearance.toggleTheme();
                }}
              >
                <Moon size={16} />
                {t('dark')}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
