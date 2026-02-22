import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

function assertAuthed(auth: { uid: string } | null | undefined): asserts auth is { uid: string } {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
}

function assertAdmin(auth: unknown): void {
  const authData = auth as { token?: Record<string, unknown> } | null | undefined;
  if (authData?.token?.isAdmin !== true) {
    throw new HttpsError('permission-denied', 'Admin privileges are required.');
  }
}

export const applyEarnings = onCall(async (request) => {
  assertAuthed(request.auth);

  const amount = Number(request.data?.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new HttpsError('invalid-argument', 'amount must be a positive integer.');
  }

  const userRef = db.collection('users').doc(request.auth.uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    const currentWallet = Number(snap.get('wallet') ?? 0);
    const nextWallet = currentWallet + amount;
    tx.update(userRef, {
      wallet: nextWallet,
      netWorth: Number(snap.get('bank') ?? 0) + nextWallet,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.create(userRef.collection('ledger').doc(), {
      type: 'earning',
      amount,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});

export const purchaseItem = onCall(async (request) => {
  assertAuthed(request.auth);

  const sku = String(request.data?.sku ?? '').trim();
  const cost = Number(request.data?.cost);
  if (!sku || !Number.isInteger(cost) || cost <= 0) {
    throw new HttpsError('invalid-argument', 'sku and positive integer cost are required.');
  }

  const userRef = db.collection('users').doc(request.auth.uid);
  const itemRef = db.collection('inventory').doc(request.auth.uid).collection('items').doc(sku);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    const wallet = Number(userSnap.get('wallet') ?? 0);
    if (wallet < cost) {
      throw new HttpsError('failed-precondition', 'Insufficient funds.');
    }

    tx.update(userRef, {
      wallet: wallet - cost,
      netWorth: Number(userSnap.get('bank') ?? 0) + (wallet - cost),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(itemRef, {
      sku,
      quantity: FieldValue.increment(1),
      acquiredAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { ok: true };
});

export const grantBadge = onCall(async (request) => {
  assertAdmin(request.auth);

  const targetUid = String(request.data?.targetUid ?? '').trim();
  const badgeId = String(request.data?.badgeId ?? '').trim();
  if (!targetUid || !badgeId) {
    throw new HttpsError('invalid-argument', 'targetUid and badgeId are required.');
  }

  await db.collection('users').doc(targetUid).collection('badges').doc(badgeId).set({
    badgeId,
    grantedBy: request.auth?.uid,
    grantedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('adminLogs').add({
    action: 'grantBadge',
    targetUid,
    badgeId,
    actorUid: request.auth?.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

export const banUser = onCall(async (request) => {
  assertAdmin(request.auth);

  const targetUid = String(request.data?.targetUid ?? '').trim();
  const reason = String(request.data?.reason ?? '').trim();

  if (!targetUid || !reason) {
    throw new HttpsError('invalid-argument', 'targetUid and reason are required.');
  }

  await db.collection('users').doc(targetUid).set({
    moderation: {
      banned: true,
      reason,
      bannedAt: FieldValue.serverTimestamp(),
      bannedBy: request.auth?.uid,
    },
  }, { merge: true });

  await db.collection('adminLogs').add({
    action: 'banUser',
    targetUid,
    reason,
    actorUid: request.auth?.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

export const publishGlobalEvent = onCall(async (request) => {
  assertAdmin(request.auth);

  const eventType = String(request.data?.eventType ?? '').trim();
  const durationMinutes = Number(request.data?.durationMinutes ?? 0);

  if (!eventType || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new HttpsError('invalid-argument', 'eventType and durationMinutes are required.');
  }

  const now = Timestamp.now();
  const endsAt = Timestamp.fromMillis(now.toMillis() + durationMinutes * 60_000);

  await db.collection('events').add({
    eventType,
    startsAt: now,
    endsAt,
    createdBy: request.auth?.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.collection('adminLogs').add({
    action: 'publishGlobalEvent',
    eventType,
    durationMinutes,
    actorUid: request.auth?.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});
