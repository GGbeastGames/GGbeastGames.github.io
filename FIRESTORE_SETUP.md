# Firestore Setup (RootAccess)

This repo now includes:
- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`

## Deploy rules/indexes

```bash
firebase login
firebase use rootaccess-1b39e
firebase deploy --only firestore:rules,firestore:indexes
```

## Auth requirement
In Firebase Console for project `rootaccess-1b39e`:
1. Go to **Authentication** → **Sign-in method**.
2. Enable **Email/Password**.
3. Save.

Without this, signup/login may return `auth/configuration-not-found` or appear unavailable.

## Data shape expected by client
- Player state: `players/{uid}/meta/gameState`
- Roles: `players/{uid}/meta/roles`
- Audit logs: `admin/auditLogs/entries/{logId}`


## Authorized domains (required for web auth)
In Firebase Console → Authentication → Settings → Authorized domains, add your hosting domain (for example `ggbeastgames.github.io`).
If this is missing, auth may fail with `auth/unauthorized-domain`.
