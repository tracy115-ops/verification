import { Moon, Sun } from 'lucide-react';
import type { AgentProfile } from '../../domain/workflow';
import type { Locale, MessageKey } from '../../shared/i18n/messages';
import { useI18n } from '../../shared/i18n/context';
import { AgentSettings } from '../agents/AgentSettings';
import { FrameworkSettings } from './FrameworkSettings';
import { LanSettings } from '../team/LanSettings';
import type { Frameworks } from '../../app/useFrameworks';
import { DataSettings } from './DataSettings';
import { LogSettings } from './LogSettings';
import { UpdateSettings } from './UpdateSettings';

export type SettingsTab = 'general' | 'agents' | 'frameworks' | 'collaboration' | 'updates' | 'data' | 'logs';
const tabs: [SettingsTab, MessageKey][] = [
  ['general', 'generalSettings'],
  ['agents', 'agents'],
  ['frameworks', 'frameworkSettings'],
  ['collaboration', 'lan_settings'],
  ['updates', 'systemUpdates'],
  ['data', 'dataManagement'],
  ['logs', 'diagnosticsLogs'],
];
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
  blocked = false,
}: {
  profiles: AgentProfile[];
  addProfile: (profile: AgentProfile) => void;
  notify: (key: MessageKey) => void;
  tab: SettingsTab;
  setTab: (tab: SettingsTab) => void;
  appearance: Appearance;
  frameworks: Frameworks;
  blocked?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="settings-page">
      <nav className="settings-navigation" aria-label={t('settings')}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className="workbench-btn wb-text"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {t(label)}
          </button>
        ))}
      </nav>
      <div className="settings-content">
        {tab === 'updates' ? (
          <UpdateSettings blocked={blocked} />
        ) : tab === 'data' ? (
          <DataSettings blocked={blocked} />
        ) : tab === 'logs' ? (
          <LogSettings />
        ) : tab === 'collaboration' ? (
          <LanSettings notify={notify} />
        ) : tab === 'frameworks' ? (
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
    </div>
  );
}
