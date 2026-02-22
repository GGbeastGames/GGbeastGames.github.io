import {
  Firestore,
  Timestamp,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

export interface UserRootDocument {
  identity: {
    uid: string;
    email: string | null;
    providerIds: string[];
    createdAt: Timestamp;
    lastLoginAt: Timestamp;
  };
  currencies: {
    soft: number;
    hard: number;
    shards: number;
  };
  progression: {
    level: number;
    xp: number;
    tutorialCompleted: boolean;
  };
  inventory: {
    slots: Record<string, { qty: number }>;
    capacity: number;
  };
  settings: {
    locale: string;
    sfxVolume: number;
    musicVolume: number;
    accessibility: {
      reducedMotion: boolean;
      colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    };
  };
}

export const userRootDocRef = (firestore: Firestore, uid: string) => doc(firestore, 'users', uid);

export const createUserBootstrapPayload = (uid: string, email: string | null, providerIds: string[]) => ({
  identity: {
    uid,
    email,
    providerIds,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  },
  currencies: {
    soft: 100,
    hard: 0,
    shards: 0,
  },
  progression: {
    level: 1,
    xp: 0,
    tutorialCompleted: false,
  },
  inventory: {
    slots: {},
    capacity: 50,
  },
  settings: {
    locale: 'en-US',
    sfxVolume: 0.8,
    musicVolume: 0.6,
    accessibility: {
      reducedMotion: false,
      colorBlindMode: 'none',
    },
  },
});

export const touchLastLogin = async (firestore: Firestore, uid: string) => {
  await setDoc(
    userRootDocRef(firestore, uid),
    { identity: { lastLoginAt: serverTimestamp() } },
    { merge: true },
  );
};

export const hasUserRootDocument = async (firestore: Firestore, uid: string) => {
  const snapshot = await getDoc(userRootDocRef(firestore, uid));
  return snapshot.exists();
};
