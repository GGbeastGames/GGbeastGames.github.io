# Rollout Phase 4 — Auth Session + Firestore Hardening

## Implemented
- Removed guest-mode entry path and guest-only UX branches.
- Enforced session-only auth persistence (`browserSessionPersistence`) so closing browser logs the user out.
- Removed active Realtime Database dependency from runtime config and app logic.
- Firestore-only persistence path retained for signed users (`players/{uid}` + `pvpQueue`).
- Cleaned stale local keys (`aionous.desktop.v4`, old guest key) and consolidated default local cache key.

## Debug outcomes
- Eliminates cross-account state bleed caused by mixed guest/signed cache keys.
- Prevents persistent login across browser restarts for cleaner auth isolation.
