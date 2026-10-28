import { useEffect, useState } from 'react';
import { lanApi } from '../../services/lan-api';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import type { MessageKey } from '../../shared/i18n/messages';
import { useLanHost } from './useLanHost';

export function LanSettings({ notify }: { notify: (key: MessageKey) => void }) {
  const { t } = useI18n();
  const actions = useLanHost(notify);
  const { host, busy, error, native, checking, perform, copy } = actions;
  const [port, setPort] = useState('4317');
  const [name, setName] = useState('Verification Workbench');
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (host) setPort(String(host.port));
    else setReveal(false);
  }, [host?.port]);
  return (
    <section className="lan-settings">
      <h2>{t('lan_settings')}</h2>
      <p className="wb-muted">{t('lan_host_hint')}</p>
      {!native ? (
        <p>{t('lan_desktop_required')}</p>
      ) : (
        <>
          {checking && <p className="wb-muted">{t('lan_checking')}</p>}
          {error && (
            <p role="alert" className="wb-error">
              {isMessageKey(error) ? t(error) : t('lan_start_failed')}
            </p>
          )}
          {!host && (
            <div className="lan-host-form">
              <label className="wb-field">
                {t('lan_service_name')}
                <input
                  className="workbench-input"
                  maxLength={80}
                  value={name}
                  disabled={!!host || busy}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="wb-field">
                {t('lan_port')}
                <input
                  className="workbench-input"
                  type="number"
                  min={1024}
                  max={65535}
                  value={port}
                  disabled={!!host || busy}
                  onChange={(event) => setPort(event.target.value)}
                />
              </label>
            </div>
          )}
          {host ? (
            <>
              <p className="lan-status">{t('lan_running')}</p>
              {!host.discoverable && <p className="wb-muted">{t('lan_discovery_unavailable')}</p>}
              {host.addresses.map((url) => (
                <div className="lan-address" key={url}>
                  <code>{url}</code>
                  <button className="workbench-btn" disabled={busy} onClick={() => void copy(url)}>
                    {t('lan_copy_address')}
                  </button>
                  <button
                    className="workbench-btn"
                    disabled={busy}
                    onClick={() => void perform(() => lanApi.open(url))}
                  >
                    {t('lan_open_browser')}
                  </button>
                </div>
              ))}
              {host.ownerToken && (
                <div className="lan-owner-token">
                  <label className="wb-field">
                    {t('lan_owner_token')}
                    <input
                      className="workbench-input"
                      readOnly
                      type={reveal ? 'text' : 'password'}
                      value={host.ownerToken}
                    />
                  </label>
                  <button className="workbench-btn" aria-pressed={reveal} onClick={() => setReveal(!reveal)}>
                    {t(reveal ? 'lan_hide_token' : 'lan_show_token')}
                  </button>
                  <button
                    className="workbench-btn"
                    disabled={busy}
                    onClick={() => void copy(host.ownerToken!)}
                  >
                    {t('lan_copy_token')}
                  </button>
                </div>
              )}
              <p className="wb-muted">{t('lan_invite_hint')}</p>
              <button className="workbench-btn" disabled={busy} onClick={() => void actions.stop()}>
                {t('lan_stop')}
              </button>
            </>
          ) : (
            <button
              className="workbench-btn wb-primary"
              disabled={
                busy ||
                !name.trim() ||
                !Number.isInteger(Number(port)) ||
                Number(port) < 1024 ||
                Number(port) > 65535
              }
              onClick={() => void actions.start(Number(port), name)}
            >
              {t(busy ? 'lan_starting' : 'lan_start')}
            </button>
          )}
        </>
      )}
    </section>
  );
}
