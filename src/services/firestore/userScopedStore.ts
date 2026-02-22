import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

const assertUid = (requestedUid: string, authUid: string) => {
  if (!requestedUid || requestedUid !== authUid) {
    throw new Error('Cross-account access denied: UID mismatch.');
  }
};

export const createUserScopedStore = (firestore: Firestore, authUid: string) => ({
  async getRoot(requestedUid: string) {
    assertUid(requestedUid, authUid);
    return getDoc(doc(firestore, 'users', authUid));
  },

  async setRoot(requestedUid: string, payload: Record<string, unknown>) {
    assertUid(requestedUid, authUid);
    await setDoc(doc(firestore, 'users', authUid), payload, { merge: true });
  },

  async getSubcollection(requestedUid: string, path: string) {
    assertUid(requestedUid, authUid);
    return getDocs(collection(firestore, 'users', authUid, path));
  },
});
