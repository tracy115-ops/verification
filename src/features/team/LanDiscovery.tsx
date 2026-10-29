import { useState } from 'react';
import { Network, RefreshCw } from 'lucide-react';
import { lanApi, type LanPeer } from '../../services/lan-api';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { ConnectionSteps } from './ConnectionSteps';

export function LanDiscovery({
  openSettings,
  join,
}: {
  openSettings: () => void;
  join: (url: string) => void;
}) {
  const { t } = useI18n();
  const [peers, setPeers] = useState<LanPeer[]>([]);
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function perform(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="lan-discovery">
      <ConnectionSteps step={1} />
      <div className="lan-discovery-heading">
        <Network size={24} />
        <h2>{t('lan_discover')}</h2>
      </div>
      <p className="wb-muted">{t('lan_join_hint')}</p>
      <div className="lan-actions">
        <button
          className="workbench-btn wb-primary"
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              setPeers(await lanApi.discover());
              setScanned(true);
            })
          }
        >
          <RefreshCw size={15} />
          {t(busy ? 'lan_scanning' : 'lan_scan')}
        </button>
        <button className="workbench-btn" disabled={busy} onClick={openSettings}>
          {t('lan_manage_host')}
        </button>
      </div>
      {error && (
        <p role="alert" className="wb-error">
          {isMessageKey(error) ? t(error) : t('lan_discovery_failed')}
        </p>
      )}
      <div className="lan-peer-list">
        {peers.map((peer) => (
          <article className="lan-peer" key={peer.id}>
            <div>
              <strong>{peer.name}</strong>
              <p className="wb-muted">{peer.url}</p>
            </div>
            <button
              className="workbench-btn wb-primary"
              disabled={busy}
              onClick={() => void perform(async () => join(peer.url))}
            >
              {t('desktopTeamJoin')}
            </button>
            <button
              className="workbench-btn"
              disabled={busy}
              onClick={() => void perform(() => lanApi.open(peer.url))}
            >
              {t('lan_join_browser')}
            </button>
          </article>
        ))}
        {scanned && !peers.length && <p className="wb-muted">{t('lan_no_peers')}</p>}
      </div>
      <form
        className="lan-manual"
        onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => join(url.trim()));
        }}
      >
        <label className="wb-field">
          {t('lan_manual_address')}
          <input
            className="workbench-input"
            placeholder="http://192.168.1.2:4317"
            value={url}
            maxLength={80}
            onChange={(event) => setUrl(event.target.value)}
            required
          />
        </label>
        <button className="workbench-btn" type="submit" disabled={busy || !url.trim()}>
          {t('desktopTeamJoin')}
        </button>
      </form>
      <p className="wb-muted">{t('lan_sync_hint')}</p>
    </div>
  );
}
