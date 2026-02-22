import { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { PersistedDesktop, createDefaultDesktopState, isPersistedDesktop, resolveHydratedDesktopState, serializeDesktopEnvelope } from '../desktopState';
import { loadLocalDesktopState } from './useLocalDesktopPersistence';

export type CloudSyncState = {
  hydratedUid: string | null;
  sessionReady: boolean;
  cloudAdmin: boolean;
  cloudSyncError: string;
};

type CloudPlayerCard = {
  roles?: { admin?: boolean };
  desktopState?: PersistedDesktop;
};

export function useCloudDesktopSync(params: {
  user: User | null;
  authReady: boolean;
  desktopState: PersistedDesktop;
  onHydrate: (next: PersistedDesktop) => void;
}) {
  const { user, authReady, desktopState, onHydrate } = params;
  const [state, setState] = useState<CloudSyncState>({ hydratedUid: null, sessionReady: false, cloudAdmin: false, cloudSyncError: '' });
  const cloudApplyRef = useRef(false);
  const retryRef = useRef<number | null>(null);

  useEffect(() => {
    if (!authReady || !user || state.hydratedUid === user.uid || state.sessionReady) return;
    const defaults = createDefaultDesktopState();

    const hydrate = async () => {
      const cloud = await getDoc(doc(db, 'players', user.uid))
        .then((snapshot) => {
          if (!snapshot.exists()) return null;
          const data = snapshot.data() as CloudPlayerCard;
          setState((prev) => ({ ...prev, cloudAdmin: Boolean(data.roles?.admin) }));
          return isPersistedDesktop(data.desktopState) ? data.desktopState : null;
        })
        .catch((error: unknown) => {
          setState((prev) => ({ ...prev, cloudSyncError: error instanceof Error ? error.message : 'Unknown Firestore error' }));
          return null;
        });

      const local = loadLocalDesktopState(user.uid);
      onHydrate(resolveHydratedDesktopState({ cloudState: cloud, localState: local, defaults }));
      setState((prev) => ({ ...prev, hydratedUid: user.uid, sessionReady: true }));
    };

    void hydrate();
  }, [authReady, user, state.hydratedUid, state.sessionReady, onHydrate]);

  useEffect(() => {
    if (!user) {
      setState({ hydratedUid: null, sessionReady: false, cloudAdmin: false, cloudSyncError: '' });
      return;
    }

    const playerRef = doc(db, 'players', user.uid);
    const unsub = onSnapshot(
      playerRef,
      (snapshot) => {
        const data = snapshot.data() as CloudPlayerCard | undefined;
        if (data?.desktopState && isPersistedDesktop(data.desktopState)) {
          cloudApplyRef.current = true;
          onHydrate(data.desktopState);
          setTimeout(() => {
            cloudApplyRef.current = false;
          }, 0);
        }
        setState((prev) => ({ ...prev, sessionReady: true, hydratedUid: user.uid, cloudAdmin: Boolean(data?.roles?.admin), cloudSyncError: '' }));
      },
      (error) => setState((prev) => ({ ...prev, cloudSyncError: error.message, sessionReady: true }))
    );

    return () => unsub();
  }, [user, onHydrate]);

  useEffect(() => {
    if (!user || !state.sessionReady || state.hydratedUid !== user.uid || cloudApplyRef.current) return;
    if (retryRef.current) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }

    const save = async () => {
      try {
        await setDoc(
          doc(db, 'players', user.uid),
          {
            ...serializeDesktopEnvelope(desktopState),
            roles: { admin: state.cloudAdmin, moderator: false },
            meta: { source: 'aionous-client', updatedAt: serverTimestamp() }
          },
          { merge: true }
        );
        setState((prev) => ({ ...prev, cloudSyncError: '' }));
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown Firestore error';
        setState((prev) => ({ ...prev, cloudSyncError: reason }));
        retryRef.current = window.setTimeout(save, 1500);
      }
    };

    const timer = window.setTimeout(save, 500);
    return () => window.clearTimeout(timer);
  }, [user, desktopState, state.sessionReady, state.hydratedUid, state.cloudAdmin]);

  return { ...state, setCloudSyncError: (cloudSyncError: string) => setState((prev) => ({ ...prev, cloudSyncError })) };
}
