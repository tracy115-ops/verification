import { useEffect, useRef, useState } from 'react';
import type { AgentProfile } from '../../domain/workflow';
import { readModelHints, type ModelHints } from '../../services/model-hints';
import { hasDesktopBridge } from '../../services/agent-api';
import { useI18n } from '../../shared/i18n/context';

export function ModelHintsPicker({
  profile,
  adopt,
}: {
  profile: AgentProfile;
  adopt: (model: string) => void;
}) {
  const { t } = useI18n();
  const [result, setResult] = useState<ModelHints>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  if (!['codex', 'claude'].includes(profile.driver)) return null;
  async function read() {
    const token = ++generation.current;
    setBusy(true);
    setFailed(false);
    setResult(undefined);
    try {
      const value = await readModelHints(profile);
      if (generation.current === token) setResult(value);
    } catch {
      if (generation.current === token) setFailed(true);
    } finally {
      if (generation.current === token) setBusy(false);
    }
  }
  return (
    <div className="settings-model-hints">
      <button
        className="workbench-btn"
        type="button"
        disabled={busy || !hasDesktopBridge()}
        onClick={() => void read()}
      >
        {t(busy ? 'detecting' : 'cliModelRead')}
      </button>
      {failed && (
        <p className="wb-error" role="alert">
          {t('cliModelReadFailed')}
        </p>
      )}
      {result && (
        <>
          <p className="wb-muted">
            {t(result.candidates.length ? 'cliModelCandidatesHint' : 'cliModelNotFound')}
          </p>
          {result.status === 'invalid' && <p className="wb-muted">{t('cliModelInvalidFile')}</p>}
          {result.candidates.map((item, index) => (
            <div key={index} className="settings-instance-choice">
              <span className="settings-instance-path">
                <code>{item.model}</code>
                <small className="wb-muted">{item.source}</small>
              </span>
              <button className="workbench-btn" type="button" onClick={() => adopt(item.model)}>
                {t('cliModelAdopt')}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
