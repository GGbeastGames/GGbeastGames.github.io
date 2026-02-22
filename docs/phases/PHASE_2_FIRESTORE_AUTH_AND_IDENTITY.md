# Rollout Phase 2 — Firestore Identity + Account Isolation

## Implemented
- Account isolation fix: local cache is now keyed per account (`aionous.desktop.v5.<uid>`), preventing one account's progress from appearing on another.
- Firestore-first PvP queue: switched queue reads/writes from Realtime DB to Firestore collection `pvpQueue`.
- Admin role source: app now reads `players/{uid}.roles.admin` and uses it as the primary admin gate signal.
- Sign-out cleanup: signed-in users are removed from Firestore PvP queue when logging out.

## Why this phase
This closes the "fake login" feeling where account A state leaked into account B due to shared local storage key.
