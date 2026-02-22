import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { browserSessionPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyDYCVuqgeOapoL-gxIvjW_UG6WSV4GZyqo',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'terminal-game-19338.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'terminal-game-19338',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'terminal-game-19338.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '202798356459',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:202798356459:web:96b9dd3669a10c8c7debae',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-S3CS8SXKXE'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const authPersistenceReady = setPersistence(auth, browserSessionPersistence).catch(() => undefined);
export const db = getFirestore(app);
export const storage = getStorage(app);

void isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
}).catch(() => {
  // Ignore analytics bootstrap errors in restricted browser/runtime contexts.
});
