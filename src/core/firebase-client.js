const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDOrfbRuZHuGMa8MnVnqVKxheLHQwTVi2o',
  authDomain: 'rootaccess-1b39e.firebaseapp.com',
  projectId: 'rootaccess-1b39e',
  storageBucket: 'rootaccess-1b39e.firebasestorage.app',
  messagingSenderId: '1089338439121',
  appId: '1:1089338439121:web:1e26fc0a5e5abb02221cf0',
  measurementId: 'G-WGQPLVYHJX',
};

function withTimeout(promise, ms, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), ms);
    }),
  ]);
}

async function getFirebaseApp() {
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js');
  return getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
}

export async function initFirebaseAuthBridge({ onStatus = () => {} } = {}) {
  onStatus('loading');

  try {
    const [app, authMod] = await withTimeout(
      Promise.all([getFirebaseApp(), import('https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js')]),
      7000,
      'firebase sdk load timeout'
    );

    const auth = authMod.getAuth(app);
    onStatus('online');

    return {
      mode: 'online',
      auth,
      sdk: authMod,
      async authenticate(neuralId, decryptKey) {
        if (!neuralId.includes('@')) {
          return {
            ok: false,
            message: 'For now, Neural_ID must be your account email until directory-lookup auth is added.',
          };
        }

        try {
          const credential = await authMod.signInWithEmailAndPassword(auth, neuralId, decryptKey);
          const user = credential.user;
          return {
            ok: true,
            user: {
              uid: user.uid,
              email: user.email || neuralId,
              emailVerified: !!user.emailVerified,
            },
          };
        } catch (error) {
          return {
            ok: false,
            message: mapFirebaseAuthError(error),
          };
        }
      },
      async register(neuralId, decryptKey) {
        if (!neuralId.includes('@')) {
          return {
            ok: false,
            message: 'Neural_ID must be a valid email to create an account in this phase.',
          };
        }

        try {
          const credential = await authMod.createUserWithEmailAndPassword(auth, neuralId, decryptKey);
          const user = credential.user;
          return {
            ok: true,
            user: {
              uid: user.uid,
              email: user.email || neuralId,
              emailVerified: !!user.emailVerified,
            },
          };
        } catch (error) {
          return {
            ok: false,
            message: mapFirebaseAuthError(error),
          };
        }
      },
    };
  } catch (error) {
    onStatus('offline');
    return {
      mode: 'offline',
      error,
      async authenticate() {
        return {
          ok: false,
          message:
            'Authentication service is unavailable right now. Check network/Firebase config and try again.',
        };
      },
      async register() {
        return {
          ok: false,
          message:
            'Signup is unavailable right now. Check network/Firebase config and try again.',
        };
      },
    };
  }
}

export async function initFirebaseDataBridge({ uid, onStatus = () => {} } = {}) {
  onStatus('loading');

  if (!uid) {
    onStatus('offline');
    return offlineDataBridge('Missing user uid for data bridge initialization.');
  }

  try {
    const [app, firestoreMod] = await withTimeout(
      Promise.all([getFirebaseApp(), import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js')]),
      7000,
      'firebase firestore sdk load timeout'
    );

    const db = firestoreMod.getFirestore(app);
    const stateRef = firestoreMod.doc(db, 'users', uid, 'meta', 'gameState');

    onStatus('online');

    return {
      mode: 'online',
      async loadState() {
        try {
          const snapshot = await firestoreMod.getDoc(stateRef);
          if (!snapshot.exists()) return { ok: true, state: null };
          return { ok: true, state: snapshot.data() };
        } catch (error) {
          return { ok: false, message: `load failed: ${String(error)}` };
        }
      },
      async saveState(state) {
        try {
          await firestoreMod.setDoc(
            stateRef,
            {
              nops: Number(state?.nops || 0),
              ownedCommands: Array.isArray(state?.ownedCommands) ? state.ownedCommands : [],
              updatedAt: Date.now(),
            },
            { merge: true }
          );
          return { ok: true };
        } catch (error) {
          return { ok: false, message: `save failed: ${String(error)}` };
        }
      },
    };
  } catch (error) {
    onStatus('offline');
    return offlineDataBridge('Firestore unavailable. Using local state only.');
  }
}

function offlineDataBridge(message) {
  return {
    mode: 'offline',
    async loadState() {
      return { ok: false, message };
    },
    async saveState() {
      return { ok: false, message };
    },
  };
}

function mapFirebaseAuthError(error) {
  const code = String(error?.code || 'auth/unknown');

  const mapping = {
    'auth/invalid-credential': 'Invalid credentials. Check Neural_ID/Decrypt-Key and try again.',
    'auth/user-not-found': 'No account found for that Neural_ID.',
    'auth/wrong-password': 'Decrypt-Key is incorrect.',
    'auth/too-many-requests': 'Too many attempts. Wait and try again.',
    'auth/network-request-failed': 'Network issue while reaching Firebase auth service.',
    'auth/invalid-email': 'Neural_ID must be a valid email format for this phase.',
    'auth/email-already-in-use': 'An account already exists for that Neural_ID. Try Sign in.',
    'auth/weak-password': 'Decrypt-Key is too weak. Use at least 6 characters.',
  };

  return mapping[code] || `Authentication failed (${code}).`;
}
