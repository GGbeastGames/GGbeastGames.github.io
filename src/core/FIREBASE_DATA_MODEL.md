# RootAccess Firebase Baseline (Phase 5)

This file defines the baseline data model and security intent for production-safe progression.

## 1) Collections

- `players/{uid}`
  - `profile`: `{ handle, avatarId, createdAt, lastLoginAt }`
  - `wallet`: `{ nops: number, lifetimeEarned: number, lifetimeSpent: number }`
  - `roles`: `{ isAdmin: boolean, isModerator: boolean, isEconomyOps: boolean }`
  - `progress`: `{ tutorialStage, faction, seasonRank, contentVersion }`

- `players/{uid}/commands/{commandId}`
  - `{ owned, hasTraitSpring, level, unlockedAt, lastRunAt, cooldownUntil }`

- `players/{uid}/inventory/{itemId}`
  - `{ type, quantity, rarity, metadata }`

- `market/companies/{ticker}`
  - `{ price, trend, volatility, updatedAt, circuitBreakerState }`

- `market/positions/{uid_ticker}`
  - `{ uid, ticker, shares, avgCost, updatedAt }`

- `pvp/matches/{matchId}`
  - `{ attackerUid, defenderUid, state, winnerUid, startedAt, endedAt }`

- `admin/auditLogs/{logId}`
  - append-only immutable admin operation logs.

## 2) Access Matrix

- Player:
  - read/write own `players/{uid}` and nested subcollections via strict field constraints.
- Admin (`roles.isAdmin == true`):
  - access admin actions through callable functions only.
- Moderator:
  - moderation actions through callable functions only.
- EconomyOps:
  - economy controls through callable functions only.

## 3) Security Rules Intent

- Never trust client economy writes.
- Block direct changes to:
  - wallet balances,
  - cooldown timestamps,
  - role flags,
  - admin log records.
- Allow only Cloud Functions to mutate those fields.

## 4) Server-Authoritative Flows

Use callable/cloud functions for:
- command execution payouts + cooldown validation,
- market transactions,
- pvp result commits,
- admin moderation actions.

## 5) Telemetry + Anti-Cheat Seeds

Per action log document:
- `uid`, `actionType`, `clientTs`, `serverTs`, `ipHash`, `sessionId`, `result`.
- Use this for anomaly scoring in later anti-cheat pipeline.
