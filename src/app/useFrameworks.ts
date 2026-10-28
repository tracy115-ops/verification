import { useState } from 'react';
import { loadFrameworks, saveFrameworks } from '../services/framework-repository';
import type { FrameworkProfile } from '../domain/execution/types';

function initialState() {
  try {
    return { profiles: loadFrameworks(localStorage), error: null as string | null };
  } catch {
    return { profiles: [], error: 'framework_storage_invalid' };
  }
}
export function useFrameworks() {
  const [initial] = useState(initialState);
  const [profiles, setProfiles] = useState(initial.profiles);
  const [error, setError] = useState(initial.error);
  function save(profile: FrameworkProfile): boolean {
    try {
      const next = profiles.some((item) => item.id === profile.id)
        ? profiles.map((item) => (item.id === profile.id ? profile : item))
        : [...profiles, profile];
      saveFrameworks(localStorage, next);
      setProfiles(next);
      setError(null);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'settingsSaveFailed');
      return false;
    }
  }
  return { profiles, error, save };
}
export type Frameworks = ReturnType<typeof useFrameworks>;
