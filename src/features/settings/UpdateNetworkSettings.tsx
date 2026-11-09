import { useProtectedDraft } from '../../shared/drafts/context';
import { DraftActions } from './DraftActions';
import { useEffect, useState } from 'react';
import * as api from '../../services/system-api';
import { hasDesktopBridge } from '../../services/agent-api';
import { isMessageKey, useI18n } from '../../shared/i18n/context';
export function UpdateNetworkSettings({ disabled }: { disabled: boolean }) {
  const { t } = useI18n();
  const [info, setInfo] = useState<api.UpdateNetwork>({
    config: { mode: 'system', address: '' },
    source: 'unknown',
  });
  const draft = useProtectedDraft({
    id: 'update-network',
    section: 'updates',
    title: '',
    label: 'updateNetworkSettings',
    initial: info.config,
  });
  const config = draft.value;
  const setConfig = draft.change;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (hasDesktopBridge())
      void api
        .updateNetwork()
        .then((value) => {
          if (active) {
            setInfo(value);
          }
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (draft.conflicted) return;
      await draft.persist(async () => {
        setInfo(await api.saveUpdateNetwork(config));
      });
    } catch (error) {
      setError(typeof error === 'string' ? error : 'update_proxy_failed');
    } finally {
      setBusy(false);
    }
  }
  const source = `updateProxySource_${info.source}`;
  return (
    <details className="settings-update-network">
      <summary>{t('updateNetworkSettings')}</summary>
      <div className="settings-network-fields">
        <p className="wb-muted">{t('updateProxyDiscovery')}</p>
        <p>
          {t('updateProxyDetected')} · {isMessageKey(source) ? t(source) : t('updateProxySource_unknown')}
        </p>
        <label className="wb-field">
          {t('updateProxyMode')}
          <select
            className="workbench-select"
            value={config.mode}
            disabled={disabled || busy || !hasDesktopBridge()}
            onChange={(event) =>
              setConfig({ mode: event.target.value as api.UpdateNetwork['config']['mode'], address: '' })
            }
          >
            <option value="system">{t('updateProxySystem')}</option>
            <option value="manual">{t('updateProxyManual')}</option>
            <option value="pac">{t('updateProxyPac')}</option>
          </select>
        </label>
        {config.mode !== 'system' && (
          <label className="wb-field">
            {t(config.mode === 'pac' ? 'updatePacAddress' : 'updateProxyAddress')}
            <input
              className="workbench-input"
              value={config.address}
              disabled={disabled || busy}
              placeholder={
                config.mode === 'pac' ? 'https://proxy.example.invalid/proxy.pac' : 'http://127.0.0.1:7890'
              }
              onChange={(event) => setConfig({ ...config, address: event.target.value })}
            />
          </label>
        )}
        <button
          className="workbench-btn"
          disabled={disabled || busy || draft.conflicted || !hasDesktopBridge()}
          onClick={() => void save()}
        >
          {t('updateProxySave')}
        </button>
        <DraftActions
          dirty={draft.dirty}
          reset={draft.reset}
          conflicted={draft.conflicted}
          busy={draft.saving}
        />
        {error && (
          <p className="wb-error" role="alert">
            {isMessageKey(error) ? t(error) : t('update_proxy_failed')}
          </p>
        )}
      </div>
    </details>
  );
}
