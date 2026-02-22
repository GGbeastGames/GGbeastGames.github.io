import { useEffect } from 'react';
import { PersistedDesktop, getStorageKey, parseDesktopEnvelope, serializeDesktopEnvelope } from '../desktopState';

export function loadLocalDesktopState(uid: string): PersistedDesktop | null {
  const raw = localStorage.getItem(getStorageKey(uid));
  if (!raw) return null;
  try {
    return parseDesktopEnvelope(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function useLocalDesktopPersistence(params: { uid: string | null; hydratedUid: string | null; desktopState: PersistedDesktop }) {
  const { uid, hydratedUid, desktopState } = params;

  useEffect(() => {
    if (!uid || hydratedUid !== uid) return;
    localStorage.setItem(getStorageKey(uid), JSON.stringify(serializeDesktopEnvelope(desktopState)));
  }, [uid, hydratedUid, desktopState]);
}
