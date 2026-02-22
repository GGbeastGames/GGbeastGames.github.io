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
  storageBucket: 'terminal-game-19338.firebasestorage.app',
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
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

## Security rules
- Firestore / Storage rule templates are in `config/FIREBASE_RULES.md`.
