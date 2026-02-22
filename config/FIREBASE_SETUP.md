# Firebase Setup Reference

This project reads Firebase values from `src/config/firebase.ts` and optional `VITE_FIREBASE_*` env vars.

## File in codebase
- Runtime config source: `src/config/firebase.ts`

## Current default config (already wired)
```ts
const firebaseConfig = {
  apiKey: 'AIzaSyDYCVuqgeOapoL-gxIvjW_UG6WSV4GZyqo',
  authDomain: 'terminal-game-19338.firebaseapp.com',
  projectId: 'terminal-game-19338',
  messagingSenderId: '202798356459',
  appId: '1:202798356459:web:96b9dd3669a10c8c7debae',
  measurementId: 'G-S3CS8SXKXE'
};
```

## Optional environment overrides
```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

## Enabled Firebase products
- Firebase Authentication
- Cloud Firestore
- Optional Analytics (only bootstraps in supported browser runtimes)

> Firebase Storage is intentionally **not** configured in this client.

## Required console checks (important)
1. In **Authentication → Sign-in method**, enable Email/Password.
2. In **Firestore Database**, ensure the DB is created in the same project as your app config.
3. Publish Firestore rules from `config/FIREBASE_RULES.md`.
4. Verify the web app keys in Firebase console match this project's `VITE_FIREBASE_*` values.

If these are not aligned, login may work but player docs may fail to create/read.

## Security rules
- Firestore rule templates are in `config/FIREBASE_RULES.md`.
