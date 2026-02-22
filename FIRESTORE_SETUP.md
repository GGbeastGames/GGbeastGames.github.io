# Firestore Setup (RootAccess)

This repo now includes:
- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`

## Deploy rules/indexes

```bash
firebase login
firebase use terminal-game-19338
firebase deploy --only firestore:rules,firestore:indexes
```

## Auth requirement
In Firebase Console for project `terminal-game-19338`:
1. Go to **Authentication** → **Sign-in method**.
2. Enable **Email/Password**.
3. Save.

Without this, signup/login may return `auth/configuration-not-found` or appear unavailable.

## Data shape expected by client
- Player state: `players/{uid}/meta/gameState`
- Roles: `players/{uid}/meta/roles`
- Audit logs: `admin/auditLogs/entries/{logId}`
