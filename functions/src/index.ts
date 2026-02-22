import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, Transaction } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

interface CommandDefinition {
  id: string;
  aliases: string[];
  cooldownMs: number;
  successChance: number;
  rewardRange: { min: number; max: number };
  penaltyRange: { min: number; max: number };
  xpRange: { min: number; max: number };
}

const COMMANDS: Record<string, CommandDefinition> = {
  phish: {
    id: 'phish',
    aliases: ['ph'],
    cooldownMs: 12_000,
    successChance: 0.56,
    rewardRange: { min: 22, max: 85 },
    penaltyRange: { min: 8, max: 34 },
    xpRange: { min: 8, max: 21 },
  },
};

const MAX_LEVEL = 500;
const XP_PER_LEVEL = 100;
const REQUEST_SPAM_WINDOW_MS = 1_500;
const RANKED_QUEUE_TTL_MS = 90_000;
const MATCH_READY_TIMEOUT_MS = 20_000;
const MATCH_DISCONNECT_TIMEOUT_MS = 45_000;
const MAX_RANKED_TRANSFER_PCT = 0.08;
const MAX_REPEAT_MATCHES_PER_DAY = 2;
const MARKET_SYMBOLS = ['VALK', 'GLYPH', 'ZERO', 'PULSE', 'TITAN'] as const;
type MarketSymbol = (typeof MARKET_SYMBOLS)[number];

type MatchState = 'pending_ready' | 'active' | 'completed' | 'abandoned';

interface SplitScreenShardState {
  shards: number;
  steals: number;
  losses: number;
}

interface MatchDoc {
  participants: [string, string];
  ranked: true;
  state: MatchState;
  readyByUid: Record<string, boolean>;
  splitScreen: Record<string, SplitScreenShardState>;
  shardTarget: number;
  disconnects: Record<string, { at: Timestamp; reason: string } | null>;
  createdAt: Timestamp;
  readyDeadlineAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  winnerUid?: string;
  loserUid?: string;
}

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

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function resolveCommand(input: string): CommandDefinition | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const direct = COMMANDS[normalized];
  if (direct) {
    return direct;
  }

  return Object.values(COMMANDS).find((command) => command.aliases.includes(normalized)) ?? null;
}

function computeLevel(xp: number): number {
  const raw = Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
  return Math.min(MAX_LEVEL, raw);
}

function assertParticipant(uid: string, match: MatchDoc): void {
  if (!match.participants.includes(uid)) {
    throw new HttpsError('permission-denied', 'Not a match participant.');
  }
}

function getOpponentUid(uid: string, participants: [string, string]): string {
  return participants[0] === uid ? participants[1] : participants[0];
}

function calcRankDelta(winnerRank: number, loserRank: number): number {
  const expected = 1 / (1 + Math.pow(10, (loserRank - winnerRank) / 400));
  return Math.max(6, Math.round(24 * (1 - expected)));
}

function calcBoundedTransfer(wallet: number): number {
  const raw = Math.floor(wallet * MAX_RANKED_TRANSFER_PCT);
  return Math.min(250, Math.max(10, raw));
}

export const executeCommand = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
  assertAuthed(request.auth);

  const commandInput = String(request.data?.command ?? '');
  const actorUid = request.auth.uid;
  const command = resolveCommand(commandInput);

  if (!command) {
    throw new HttpsError('invalid-argument', 'Unsupported command.');
  }

  const userRef = db.collection('users').doc(actorUid);
  const cooldownRef = db.collection('cooldowns').doc(actorUid).collection('commands').doc(command.id);
  const historyRef = userRef.collection('commandHistory').doc();

  const now = Timestamp.now();
  const nowMillis = now.toMillis();
  const didSucceed = Math.random() <= command.successChance;
  const walletDelta = didSucceed
    ? randomInRange(command.rewardRange.min, command.rewardRange.max)
    : -randomInRange(command.penaltyRange.min, command.penaltyRange.max);
  const xpDelta = randomInRange(command.xpRange.min, command.xpRange.max);

  const result = await db.runTransaction(async (tx: Transaction) => {
    const [userSnap, cooldownSnap] = await Promise.all([tx.get(userRef), tx.get(cooldownRef)]);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    const currentWallet = Number(userSnap.get('wallet') ?? 0);
    const currentBank = Number(userSnap.get('bank') ?? 0);
    const currentXp = Number(userSnap.get('progression.xp') ?? userSnap.get('xp') ?? 0);

    const lastCommandAtRaw = userSnap.get('progression.lastCommandAt');
    const lastCommandAtMillis = lastCommandAtRaw instanceof Timestamp ? lastCommandAtRaw.toMillis() : 0;

    if (lastCommandAtMillis > 0 && nowMillis - lastCommandAtMillis < REQUEST_SPAM_WINDOW_MS) {
      throw new HttpsError('resource-exhausted', 'Command spam detected. Slow down.');
    }

    const nextAllowedAtRaw = cooldownSnap.get('nextAllowedAt');
    if (nextAllowedAtRaw instanceof Timestamp && nextAllowedAtRaw.toMillis() > nowMillis) {
      const remainingMs = nextAllowedAtRaw.toMillis() - nowMillis;
      throw new HttpsError('failed-precondition', `Cooldown active. Retry in ${Math.ceil(remainingMs / 1000)}s.`);
    }

    const nextWallet = Math.max(0, currentWallet + walletDelta);
    const netWorth = currentBank + nextWallet;
    const nextXp = currentXp + xpDelta;
    const nextLevel = computeLevel(nextXp);
    const nextAllowedAt = Timestamp.fromMillis(nowMillis + command.cooldownMs);

    tx.update(userRef, {
      wallet: nextWallet,
      netWorth,
      xp: nextXp,
      progression: {
        xp: nextXp,
        level: nextLevel,
        maxLevel: MAX_LEVEL,
        lastCommandAt: now,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(cooldownRef, {
      uid: actorUid,
      commandId: command.id,
      lastUsedAt: now,
      nextAllowedAt,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.create(historyRef, {
      commandId: command.id,
      input: commandInput,
      success: didSucceed,
      walletDelta,
      xpDelta,
      walletAfter: nextWallet,
      xpAfter: nextXp,
      levelAfter: nextLevel,
      createdAt: now,
      source: 'executeCommand',
    });

    tx.create(userRef.collection('ledger').doc(), {
      type: didSucceed ? 'command-reward' : 'command-penalty',
      commandId: command.id,
      amount: walletDelta,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      ok: true,
      commandId: command.id,
      success: didSucceed,
      walletDelta,
      walletAfter: nextWallet,
      xpDelta,
      xpAfter: nextXp,
      levelAfter: nextLevel,
      cooldownUntilMs: nextAllowedAt.toMillis(),
      message: didSucceed ? 'Phishing run succeeded.' : 'Phishing run failed. Trace detected.',
    };
  });

  return result;
});

export const applyEarnings = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
  assertAuthed(request.auth);

  const amount = Number(request.data?.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new HttpsError('invalid-argument', 'amount must be a positive integer.');
  }

  const userRef = db.collection('users').doc(request.auth.uid);

  await db.runTransaction(async (tx: Transaction) => {
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

export const purchaseItem = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
  assertAuthed(request.auth);

  const sku = String(request.data?.sku ?? '').trim();
  const cost = Number(request.data?.cost);
  if (!sku || !Number.isInteger(cost) || cost <= 0) {
    throw new HttpsError('invalid-argument', 'sku and positive integer cost are required.');
  }

  const userRef = db.collection('users').doc(request.auth.uid);
  const itemRef = db.collection('inventory').doc(request.auth.uid).collection('items').doc(sku);

  await db.runTransaction(async (tx: Transaction) => {
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

export const grantBadge = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
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

export const banUser = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
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

export const publishGlobalEvent = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
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

export const refreshMarketListings = onSchedule('every 60 minutes', async () => {
  const now = Timestamp.now();

  const marketRef = db.collection('market').doc('state');
  const snap = await marketRef.get();
  const previousQuotes = (snap.get('quotes') ?? {}) as Record<string, number>;

  const quotes = Object.fromEntries(
    MARKET_SYMBOLS.map((symbol) => {
      const previous = Number(previousQuotes[symbol] ?? 30);
      const drift = 1 + (Math.random() * 0.24 - 0.12);
      const next = Math.max(3, Math.round(previous * drift));
      return [symbol, next];
    }),
  );

  await marketRef.set(
    {
      quotes,
      listingsRefreshAt: now,
      listingsWindowEndsAt: Timestamp.fromMillis(now.toMillis() + 15 * 60_000),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
});

export const purchaseShares = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
  assertAuthed(request.auth);

  const symbol = String(request.data?.symbol ?? '').trim().toUpperCase() as MarketSymbol;
  const shares = Number(request.data?.shares ?? 0);

  if (!MARKET_SYMBOLS.includes(symbol) || !Number.isInteger(shares) || shares <= 0) {
    throw new HttpsError('invalid-argument', 'Valid symbol and positive integer shares are required.');
  }

  const userRef = db.collection('users').doc(request.auth.uid);
  const holdingsRef = userRef.collection('holdings').doc(symbol);
  const marketRef = db.collection('market').doc('state');

  await db.runTransaction(async (tx) => {
    const [userSnap, marketSnap] = await Promise.all([tx.get(userRef), tx.get(marketRef)]);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    const quotes = (marketSnap.get('quotes') ?? {}) as Record<string, number>;
    const listingEndsRaw = marketSnap.get('listingsWindowEndsAt');
    const listingEndsAt = listingEndsRaw instanceof Timestamp ? listingEndsRaw.toMillis() : 0;
    const now = Date.now();
    if (listingEndsAt > 0 && now > listingEndsAt) {
      throw new HttpsError('failed-precondition', 'Listing window closed.');
    }

    const price = Number(quotes[symbol] ?? 0);
    if (price <= 0) {
      throw new HttpsError('failed-precondition', 'Quote unavailable.');
    }

    const cost = price * shares;
    const wallet = Number(userSnap.get('wallet') ?? 0);
    if (wallet < cost) {
      throw new HttpsError('failed-precondition', 'Insufficient funds.');
    }

    tx.update(userRef, {
      wallet: wallet - cost,
      netWorth: Number(userSnap.get('bank') ?? 0) + (wallet - cost),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      holdingsRef,
      {
        symbol,
        shares: FieldValue.increment(shares),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.create(userRef.collection('holdingsHistory').doc(), {
      symbol,
      shares,
      price,
      side: 'buy',
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});

export const queueForRankedMatch = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
  assertAuthed(request.auth);
  const uid = request.auth.uid;
  const now = Timestamp.now();
  const queueRef = db.collection('pvpQueues').doc(uid);

  await queueRef.set(
    {
      uid,
      mode: 'ranked',
      status: 'queued',
      queuedAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + RANKED_QUEUE_TTL_MS),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const candidates = await db
    .collection('pvpQueues')
    .where('mode', '==', 'ranked')
    .where('status', '==', 'queued')
    .orderBy('queuedAt', 'asc')
    .limit(20)
    .get();

  const candidate = candidates.docs.find((doc) => doc.id !== uid && (doc.get('expiresAt') as Timestamp)?.toMillis() > now.toMillis());
  if (!candidate) {
    return { ok: true, matched: false };
  }

  const opponentUid = candidate.id;
  const matchRef = db.collection('matches').doc();
  const readyDeadlineAt = Timestamp.fromMillis(now.toMillis() + MATCH_READY_TIMEOUT_MS);

  await db.runTransaction(async (tx) => {
    const [selfQueueSnap, oppQueueSnap] = await Promise.all([tx.get(queueRef), tx.get(candidate.ref)]);
    if (selfQueueSnap.get('status') !== 'queued' || oppQueueSnap.get('status') !== 'queued') {
      throw new HttpsError('aborted', 'Queue race detected, retry matchmaking.');
    }

    const matchPayload: MatchDoc = {
      participants: [uid, opponentUid],
      ranked: true,
      state: 'pending_ready',
      readyByUid: { [uid]: false, [opponentUid]: false },
      splitScreen: {
        [uid]: { shards: 0, steals: 0, losses: 0 },
        [opponentUid]: { shards: 0, steals: 0, losses: 0 },
      },
      shardTarget: 20,
      disconnects: { [uid]: null, [opponentUid]: null },
      createdAt: now,
      readyDeadlineAt,
    };

    tx.create(matchRef, matchPayload);
    tx.update(queueRef, { status: 'matched', matchId: matchRef.id, updatedAt: FieldValue.serverTimestamp() });
    tx.update(candidate.ref, { status: 'matched', matchId: matchRef.id, updatedAt: FieldValue.serverTimestamp() });
  });

  return { ok: true, matched: true, matchId: matchRef.id };
});

export const setMatchReady = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
  assertAuthed(request.auth);
  const uid = request.auth.uid;
  const matchId = String(request.data?.matchId ?? '').trim();
  if (!matchId) {
    throw new HttpsError('invalid-argument', 'matchId is required.');
  }

  const matchRef = db.collection('matches').doc(matchId);
  const now = Timestamp.now();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Match not found.');
    }
    const match = snap.data() as MatchDoc;
    assertParticipant(uid, match);
    if (match.state !== 'pending_ready') {
      return { started: match.state === 'active', state: match.state };
    }
    if (match.readyDeadlineAt.toMillis() < now.toMillis()) {
      tx.update(matchRef, { state: 'abandoned', completedAt: now, updatedAt: FieldValue.serverTimestamp() });
      return { started: false, state: 'abandoned' };
    }

    const nextReady = { ...match.readyByUid, [uid]: true };
    const everyoneReady = Object.values(nextReady).every(Boolean);
    tx.update(matchRef, {
      readyByUid: nextReady,
      state: everyoneReady ? 'active' : 'pending_ready',
      startedAt: everyoneReady ? now : match.startedAt,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { started: everyoneReady, state: everyoneReady ? 'active' : 'pending_ready' };
  });

  return { ok: true, ...result };
});

export const submitShardScore = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
  assertAuthed(request.auth);
  const uid = request.auth.uid;
  const matchId = String(request.data?.matchId ?? '').trim();
  const shardDelta = Number(request.data?.shardDelta ?? 0);
  const steals = Math.max(0, Number(request.data?.steals ?? 0));
  const losses = Math.max(0, Number(request.data?.losses ?? 0));
  if (!matchId || !Number.isInteger(shardDelta)) {
    throw new HttpsError('invalid-argument', 'matchId and integer shardDelta are required.');
  }

  const matchRef = db.collection('matches').doc(matchId);
  const now = Timestamp.now();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Match not found.');
    }
    const match = snap.data() as MatchDoc;
    assertParticipant(uid, match);
    if (match.state !== 'active') {
      throw new HttpsError('failed-precondition', 'Match is not active.');
    }

    const current = match.splitScreen[uid] ?? { shards: 0, steals: 0, losses: 0 };
    const nextScore: SplitScreenShardState = {
      shards: Math.max(0, current.shards + shardDelta),
      steals: current.steals + steals,
      losses: current.losses + losses,
    };

    const splitScreen = { ...match.splitScreen, [uid]: nextScore };
    const winnerReached = nextScore.shards >= match.shardTarget;
    tx.update(matchRef, {
      splitScreen,
      state: winnerReached ? 'completed' : 'active',
      winnerUid: winnerReached ? uid : match.winnerUid,
      loserUid: winnerReached ? getOpponentUid(uid, match.participants) : match.loserUid,
      completedAt: winnerReached ? now : match.completedAt,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { splitScreen, completed: winnerReached };
  });

  return { ok: true, ...result };
});

export const resolveRankedMatch = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
  assertAuthed(request.auth);
  const uid = request.auth.uid;
  const matchId = String(request.data?.matchId ?? '').trim();
  if (!matchId) {
    throw new HttpsError('invalid-argument', 'matchId is required.');
  }

  const matchRef = db.collection('matches').doc(matchId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Match not found.');
    }
    const match = snap.data() as MatchDoc;
    assertParticipant(uid, match);
    if (match.state !== 'completed' || !match.winnerUid || !match.loserUid) {
      throw new HttpsError('failed-precondition', 'Match has no final winner yet.');
    }

    const winnerRef = db.collection('users').doc(match.winnerUid);
    const loserRef = db.collection('users').doc(match.loserUid);
    const [winnerSnap, loserSnap] = await Promise.all([tx.get(winnerRef), tx.get(loserRef)]);
    if (!winnerSnap.exists || !loserSnap.exists) {
      throw new HttpsError('not-found', 'Player profile missing.');
    }

    const winnerRank = Number(winnerSnap.get('rank.points') ?? 1000);
    const loserRank = Number(loserSnap.get('rank.points') ?? 1000);
    const winnerWallet = Number(winnerSnap.get('wallet') ?? 0);
    const loserWallet = Number(loserSnap.get('wallet') ?? 0);

    const antiFarmRef = db
      .collection('pvpPairs')
      .doc([match.winnerUid, match.loserUid].sort().join('__'));
    const antiFarmSnap = await tx.get(antiFarmRef);
    const today = new Date().toISOString().slice(0, 10);
    const pairDay = String(antiFarmSnap.get('day') ?? '');
    const pairMatches = pairDay === today ? Number(antiFarmSnap.get('matches') ?? 0) : 0;
    const antiFarmReduced = pairMatches >= MAX_REPEAT_MATCHES_PER_DAY;

    const rawDelta = calcRankDelta(winnerRank, loserRank);
    const rankDelta = antiFarmReduced ? Math.max(1, Math.floor(rawDelta / 3)) : rawDelta;
    const rawTransfer = calcBoundedTransfer(loserWallet);
    const transfer = antiFarmReduced ? Math.floor(rawTransfer / 2) : rawTransfer;

    tx.update(winnerRef, {
      wallet: winnerWallet + transfer,
      rank: { points: winnerRank + rankDelta, gamesPlayed: FieldValue.increment(1), wins: FieldValue.increment(1) },
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(loserRef, {
      wallet: Math.max(0, loserWallet - transfer),
      rank: { points: Math.max(0, loserRank - rankDelta), gamesPlayed: FieldValue.increment(1), losses: FieldValue.increment(1) },
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(matchRef, {
      settlement: {
        rankDelta,
        transfer,
        antiFarmReduced,
        settledAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      antiFarmRef,
      {
        day: today,
        matches: FieldValue.increment(1),
        lastMatchId: matchId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { rankDelta, transfer, antiFarmReduced };
  });

  return { ok: true, ...result };
});

export const reportMatchDisconnect = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
  assertAuthed(request.auth);
  const uid = request.auth.uid;
  const matchId = String(request.data?.matchId ?? '').trim();
  const reason = String(request.data?.reason ?? 'network').slice(0, 80);
  if (!matchId) {
    throw new HttpsError('invalid-argument', 'matchId is required.');
  }

  const now = Timestamp.now();
  const reconnectDeadlineAt = Timestamp.fromMillis(now.toMillis() + MATCH_DISCONNECT_TIMEOUT_MS);
  const matchRef = db.collection('matches').doc(matchId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Match not found.');
    }
    const match = snap.data() as MatchDoc;
    assertParticipant(uid, match);
    tx.update(matchRef, {
      [`disconnects.${uid}`]: { at: now, reason, reconnectDeadlineAt },
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, reconnectDeadlineMs: reconnectDeadlineAt.toMillis() };
});

export const rejoinMatch = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
  assertAuthed(request.auth);
  const uid = request.auth.uid;
  const matchId = String(request.data?.matchId ?? '').trim();
  if (!matchId) {
    throw new HttpsError('invalid-argument', 'matchId is required.');
  }

  const matchRef = db.collection('matches').doc(matchId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Match not found.');
    }
    const match = snap.data() as MatchDoc;
    assertParticipant(uid, match);
    tx.update(matchRef, {
      [`disconnects.${uid}`]: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});
