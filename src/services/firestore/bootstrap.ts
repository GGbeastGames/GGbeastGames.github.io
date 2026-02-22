import { User } from 'firebase/auth';
import {
  Firestore,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { createUserBootstrapPayload, userRootDocRef } from './userRoot';

/**
 * First-login bootstrap transaction.
 * - Creates users/{uid} exactly once.
 * - Updates lastLoginAt on every login.
 * - Never reads or writes outside users/{uid}.
 */
export const bootstrapUserOnLogin = async (firestore: Firestore, user: User) => {
  const ref = userRootDocRef(firestore, user.uid);
  const providerIds = user.providerData
    .map((provider) => provider.providerId)
    .filter((providerId): providerId is string => Boolean(providerId));

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists()) {
      transaction.set(ref, createUserBootstrapPayload(user.uid, user.email, providerIds));
      return;
    }

    transaction.update(ref, {
      'identity.lastLoginAt': serverTimestamp(),
      'identity.email': user.email,
      'identity.providerIds': providerIds,
    });
  });
};
