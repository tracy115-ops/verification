import { useState } from 'react';
import { TEAM_SERVER_KEY, serverAddress } from '../../domain/team/server-address';
import { LanDiscovery } from './LanDiscovery';
import { TeamWorkspace } from './TeamWorkspace';

function restoredServer() {
  try {
    const value = localStorage.getItem(TEAM_SERVER_KEY);
    return value ? serverAddress(value) : '';
  } catch {
    return '';
  }
}

export function DesktopTeamWorkspace({ openSettings }: { openSettings: () => void }) {
  const [server, setServer] = useState(restoredServer);
  if (!server)
    return (
      <LanDiscovery
        openSettings={openSettings}
        join={(address) => {
          const value = serverAddress(address);
          localStorage.setItem(TEAM_SERVER_KEY, value);
          setServer(value);
        }}
      />
    );
  return (
    <TeamWorkspace
      key={server}
      serverUrl={server}
      leaveServer={() => {
        localStorage.removeItem(TEAM_SERVER_KEY);
        setServer('');
      }}
    />
  );
}
