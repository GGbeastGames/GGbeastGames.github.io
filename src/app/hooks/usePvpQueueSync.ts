import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { PvpQueueEntry } from '../../game/pvp';

export function usePvpQueueSync(userUid: string | null, alias: string, rankedPoints: number) {
  const [pvpQueue, setPvpQueue] = useState<PvpQueueEntry[]>([]);
  const [inPvpQueue, setInPvpQueue] = useState(false);

  useEffect(() => {
    if (!userUid) {
      setPvpQueue([]);
      setInPvpQueue(false);
      return;
    }

    const queueQuery = query(collection(db, 'pvpQueue'), orderBy('queuedAt', 'desc'));
    const unsub = onSnapshot(
      queueQuery,
      (snap) => {
        const rows: PvpQueueEntry[] = snap.docs.map((row) => {
          const value = row.data() as { alias: string; rankedPoints: number; queuedAt: number };
          return { id: row.id, alias: value.alias, rankedPoints: value.rankedPoints, queuedAt: value.queuedAt };
        });
        setPvpQueue(rows);
        setInPvpQueue(rows.some((entry) => entry.id === userUid));
      },
      () => {
        setPvpQueue([]);
        setInPvpQueue(false);
      }
    );

    return () => {
      void deleteDoc(doc(db, 'pvpQueue', userUid));
      unsub();
    };
  }, [userUid]);

  async function joinQueue() {
    if (!userUid) return;
    await setDoc(doc(db, 'pvpQueue', userUid), { uid: userUid, alias, rankedPoints, queuedAt: Date.now() });
    setInPvpQueue(true);
  }

  async function leaveQueue() {
    if (!userUid) return;
    await deleteDoc(doc(db, 'pvpQueue', userUid));
    setInPvpQueue(false);
  }

  return { pvpQueue, inPvpQueue, joinQueue, leaveQueue, setInPvpQueue };
}
