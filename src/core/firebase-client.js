const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDOrfbRuZHuGMa8MnVnqVKxheLHQwTVi2o',
  authDomain: 'rootaccess-1b39e.firebaseapp.com',
  databaseURL: 'https://rootaccess-1b39e-default-rtdb.firebaseio.com',
  projectId: 'rootaccess-1b39e',
  storageBucket: 'rootaccess-1b39e.firebasestorage.app',
  messagingSenderId: '1089338439121',
  appId: '1:1089338439121:web:1e26fc0a5e5abb02221cf0',
  measurementId: 'G-WGQPLVYHJX',
};

const FIREBASE_SDK_TIMEOUT_MS = 20000;
const FIREBASE_SDK_LOAD_RETRIES = 2;

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

async function loadFirebaseModule(moduleName) {
  let lastError = null;

  for (let attempt = 1; attempt <= FIREBASE_SDK_LOAD_RETRIES; attempt += 1) {
    try {
      const result = await withTimeout(
        import(`https://www.gstatic.com/firebasejs/10.13.1/${moduleName}.js`),
        FIREBASE_SDK_TIMEOUT_MS,
        `${moduleName} load timeout (${attempt}/${FIREBASE_SDK_LOAD_RETRIES})`
      );
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < FIREBASE_SDK_LOAD_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      }
    }
  }

  throw lastError || new Error(`${moduleName} failed to load`);
}

export async function initFirebaseAuthBridge({ onStatus = () => {} } = {}) {
  onStatus('loading');

  try {
    const app = await getFirebaseApp();
    const authMod = await loadFirebaseModule('firebase-auth');
    const auth = authMod.getAuth(app);
    onStatus('online');

    return {
      mode: 'online',
      auth,
      sdk: authMod,
      reason: '',
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
    const reason = String(error?.message || error || 'unknown auth bridge init error');

    return {
      mode: 'offline',
      error,
      reason,
      async authenticate() {
        return {
          ok: false,
          message:
            `Authentication service is unavailable right now. Check network/Firebase config and try again. (${reason})`,
        };
      },
      async register() {
        return {
          ok: false,
          message:
            `Signup is unavailable right now. Check network/Firebase config and try again. (${reason})`,
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
    const app = await getFirebaseApp();
    const firestoreMod = await loadFirebaseModule('firebase-firestore');

    const db = firestoreMod.getFirestore(app);
    const playerRef = firestoreMod.doc(db, 'players', uid);
    const stateRef = firestoreMod.doc(db, 'players', uid, 'meta', 'gameState');
    const roleRef = firestoreMod.doc(db, 'players', uid, 'meta', 'roles');
    const statsRef = firestoreMod.doc(db, 'players', uid, 'meta', 'stats');
    const auditLogsRef = firestoreMod.collection(db, 'admin', 'auditLogs', 'entries');

    onStatus('online');

    return {
      mode: 'online',
      async ensurePlayerRecord(user) {
        try {
          await firestoreMod.setDoc(
            playerRef,
            {
              uid,
              email: user?.email || null,
              handle: user?.email ? user.email.split('@')[0] : `player_${uid.slice(0, 6)}`,
              status: 'active',
              createdAt: Date.now(),
              lastLoginAt: Date.now(),
            },
            { merge: true }
          );
          return { ok: true };
        } catch (error) {
          return { ok: false, message: `player record init failed: ${String(error)}` };
        }
      },
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
              marketHoldings: state?.marketHoldings && typeof state.marketHoldings === 'object' ? state.marketHoldings : {},
              updatedAt: Date.now(),
            },
            { merge: true }
          );
          return { ok: true };
        } catch (error) {
          return { ok: false, message: `save failed: ${String(error)}` };
        }
      },
      async loadPlayerBundle() {
        try {
          const [playerSnap, stateSnap, statsSnap] = await Promise.all([
            firestoreMod.getDoc(playerRef),
            firestoreMod.getDoc(stateRef),
            firestoreMod.getDoc(statsRef),
          ]);
          return {
            ok: true,
            bundle: {
              profile: playerSnap.exists() ? playerSnap.data() : null,
              state: stateSnap.exists() ? stateSnap.data() : null,
              stats: statsSnap.exists() ? statsSnap.data() : null,
            },
          };
        } catch (error) {
          return { ok: false, message: `bundle load failed: ${String(error)}` };
        }
      },
      async savePlayerBundle(payload) {
        try {
          const now = Date.now();
          await Promise.all([
            firestoreMod.setDoc(
              playerRef,
              {
                uid,
                email: payload?.profile?.email || null,
                handle: payload?.profile?.handle || null,
                status: payload?.profile?.status || 'active',
                lastLoginAt: now,
                updatedAt: now,
              },
              { merge: true }
            ),
            firestoreMod.setDoc(
              stateRef,
              {
                nops: Number(payload?.state?.nops || 0),
                ownedCommands: Array.isArray(payload?.state?.ownedCommands) ? payload.state.ownedCommands : [],
                marketHoldings: payload?.state?.marketHoldings && typeof payload.state.marketHoldings === 'object' ? payload.state.marketHoldings : {},
                updatedAt: now,
              },
              { merge: true }
            ),
            firestoreMod.setDoc(
              statsRef,
              {
                totalCommandsOwned: Number(payload?.stats?.totalCommandsOwned || 0),
                portfolioValue: Number(payload?.stats?.portfolioValue || 0),
                totalEquity: Number(payload?.stats?.totalEquity || 0),
                updatedAt: now,
              },
              { merge: true }
            ),
          ]);
          return { ok: true };
        } catch (error) {
          return { ok: false, message: `bundle save failed: ${String(error)}` };
        }
      },
      async loadRoles() {
        try {
          const snapshot = await firestoreMod.getDoc(roleRef);
          if (!snapshot.exists()) {
            return {
              ok: true,
              roles: { isAdmin: false, isModerator: false, isEconomyOps: false },
            };
          }
          return { ok: true, roles: snapshot.data() };
        } catch (error) {
          return { ok: false, message: `roles load failed: ${String(error)}` };
        }
      },
      async ensureRolesDoc() {
        try {
          await firestoreMod.setDoc(
            roleRef,
            {
              isAdmin: false,
              isModerator: false,
              isEconomyOps: false,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
          return { ok: true };
        } catch (error) {
          return { ok: false, message: `roles init failed: ${String(error)}` };
        }
      },
      async appendAuditLog(entry) {
        try {
          await firestoreMod.addDoc(auditLogsRef, {
            ...entry,
            serverTs: Date.now(),
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, message: `audit log failed: ${String(error)}` };
        }
      },
    };
  } catch (error) {
    onStatus('offline');
    return offlineDataBridge(`Firestore unavailable. Using local state only. (${String(error?.message || error)})`);
  }
}

function offlineDataBridge(message) {
  return {
    mode: 'offline',
    async ensurePlayerRecord() {
      return { ok: false, message };
    },
    async loadState() {
      return { ok: false, message };
    },
    async saveState() {
      return { ok: false, message };
    },
    async loadPlayerBundle() {
      return { ok: false, message };
    },
    async savePlayerBundle() {
      return { ok: false, message };
    },
    async loadRoles() {
      return {
        ok: true,
        roles: { isAdmin: false, isModerator: false, isEconomyOps: false },
      };
    },
    async ensureRolesDoc() {
      return { ok: false, message };
    },
    async appendAuditLog() {
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
    'auth/operation-not-allowed': 'Email/Password auth is disabled. Enable it in Firebase Console > Authentication > Sign-in method.',
    'auth/configuration-not-found': 'Firebase Auth is not fully configured. Enable Email/Password sign-in in Firebase Console > Authentication > Sign-in method, and verify the project matches this app config.',
    'auth/unauthorized-domain': 'This domain is not authorized in Firebase Auth. Add it under Authentication > Settings > Authorized domains.',
  };

  return mapping[code] || `Authentication failed (${code}).`;
}
