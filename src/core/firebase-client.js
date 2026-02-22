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

export async function initFirebaseAuthBridge({ onStatus = () => {} } = {}) {
  onStatus('loading');

  try {
    const [{ initializeApp, getApps }, authMod] = await withTimeout(
      Promise.all([
        import('https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js'),
      ]),
      7000,
      'firebase sdk load timeout'
    );

    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
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
    };
  }
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
  };

  return mapping[code] || `Authentication failed (${code}).`;
}
