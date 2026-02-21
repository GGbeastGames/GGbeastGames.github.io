import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { auth } from './config/firebase';

type AppPhase = 'boot' | 'login' | 'desktop';
type AppId = 'terminal' | 'market' | 'index' | 'profile' | 'settings';

type WindowState = {
  id: AppId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isOpen: boolean;
  isMinimized: boolean;
  z: number;
};

type PersistedDesktop = {
  windows: WindowState[];
};

const STORAGE_KEY = 'aionous.desktop.v1';
const BOOT_MS = 2600;

const appTemplates: Record<AppId, Omit<WindowState, 'isOpen' | 'isMinimized' | 'z'>> = {
  terminal: { id: 'terminal', title: 'Terminal', x: 72, y: 84, width: 520, height: 360 },
  market: { id: 'market', title: 'Black Market', x: 170, y: 130, width: 460, height: 290 },
  index: { id: 'index', title: 'Index', x: 220, y: 176, width: 420, height: 280 },
  profile: { id: 'profile', title: 'Profile', x: 300, y: 108, width: 390, height: 310 },
  settings: { id: 'settings', title: 'Settings', x: 380, y: 150, width: 360, height: 250 }
};

function seedWindows(): WindowState[] {
  return (Object.keys(appTemplates) as AppId[]).map((id, i) => ({
    ...appTemplates[id],
    isOpen: id === 'terminal',
    isMinimized: false,
    z: i + 1
  }));
}

function readPersistedWindows(): WindowState[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedWindows();
    const parsed = JSON.parse(raw) as PersistedDesktop;
    if (!Array.isArray(parsed.windows)) return seedWindows();
    return parsed.windows;
  } catch {
    return seedWindows();
  }
}

export function App() {
  const [phase, setPhase] = useState<AppPhase>('boot');
  const [windows, setWindows] = useState<WindowState[]>(() => readPersistedWindows());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);

  const dragRef = useRef<{ id: AppId; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase('login'), BOOT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        setPhase('desktop');
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ windows } satisfies PersistedDesktop));
  }, [windows]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragRef.current) return;
      const { id, offsetX, offsetY } = dragRef.current;
      const maxX = Math.max(window.innerWidth - 240, 16);
      const maxY = Math.max(window.innerHeight - 200, 16);

      setWindows((prev) =>
        prev.map((windowItem) =>
          windowItem.id === id
            ? {
                ...windowItem,
                x: Math.min(Math.max(16, event.clientX - offsetX), maxX),
                y: Math.min(Math.max(48, event.clientY - offsetY), maxY)
              }
            : windowItem
        )
      );
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const desktopIdentity = useMemo(() => {
    if (guestMode) return 'Guest Operator';
    return user?.email ?? 'Anonymous';
  }, [guestMode, user]);

  const topZ = useMemo(() => Math.max(...windows.map((windowItem) => windowItem.z), 0), [windows]);

  function bringToFront(id: AppId) {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, z: topZ + 1 } : w)));
  }

  function openWindow(id: AppId) {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              isOpen: true,
              isMinimized: false,
              z: topZ + 1
            }
          : w
      )
    );
  }

  function closeWindow(id: AppId) {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isOpen: false } : w)));
  }

  function toggleMinimize(id: AppId) {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              isMinimized: !w.isMinimized,
              z: !w.isMinimized ? w.z : topZ + 1
            }
          : w
      )
    );
  }

  async function onSubmitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setPhase('desktop');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    setGuestMode(false);
    setPhase('login');
  }

  if (phase === 'boot') {
    return (
      <main className="boot-screen">
        <div className="boot-overlay" />
        <div className="boot-content">
          <p>ROOTACCESS // BOOTING NEURAL GRID</p>
          <h1>01001110 01000101 01001111 01001110</h1>
          <div className="boot-loader" />
        </div>
      </main>
    );
  }

  if (phase === 'login') {
    return (
      <main className="login-screen">
        <section className="login-card">
          <p className="kicker">ACCESS TERMINAL</p>
          <h1>Neural Link Login</h1>
          <p className="muted">Sign in with Firebase auth, or enter as guest for local prototype mode.</p>

          <form onSubmit={onSubmitAuth} className="auth-form">
            <label>
              Neural_ID
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="operator@aionous.net"
              />
            </label>
            <label>
              Decrypt-Key
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="••••••••"
              />
            </label>

            <button type="submit" disabled={authLoading}>
              {authLoading ? 'Authenticating...' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="login-actions">
            <button type="button" onClick={() => setAuthMode((p) => (p === 'signin' ? 'signup' : 'signin'))}>
              Switch to {authMode === 'signin' ? 'Create Account' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => {
                setGuestMode(true);
                setPhase('desktop');
              }}
            >
              Enter as Guest
            </button>
          </div>

          {authError ? <p className="error">{authError}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="desktop-shell">
      <div className="desktop-wallpaper" />

      <header className="desktop-header">
        <div>
          <p className="kicker">Aionous OS // Phase 3</p>
          <h2>Operator: {desktopIdentity}</h2>
        </div>
        <button type="button" onClick={handleSignOut} className="danger">
          Sign Out
        </button>
      </header>

      <section className="window-layer">
        {windows
          .filter((windowItem) => windowItem.isOpen && !windowItem.isMinimized)
          .sort((a, b) => a.z - b.z)
          .map((windowItem) => (
            <article
              key={windowItem.id}
              className="app-window"
              style={{
                top: windowItem.y,
                left: windowItem.x,
                width: windowItem.width,
                height: windowItem.height,
                zIndex: windowItem.z
              }}
              onMouseDown={() => bringToFront(windowItem.id)}
            >
              <header
                className="window-bar"
                onMouseDown={(event) => {
                  dragRef.current = {
                    id: windowItem.id,
                    offsetX: event.clientX - windowItem.x,
                    offsetY: event.clientY - windowItem.y
                  };
                  bringToFront(windowItem.id);
                }}
              >
                <p>{windowItem.title}</p>
                <div className="window-buttons">
                  <button type="button" onClick={() => toggleMinimize(windowItem.id)}>
                    _
                  </button>
                  <button type="button" onClick={() => closeWindow(windowItem.id)}>
                    ×
                  </button>
                </div>
              </header>

              <div className="window-content">{renderWindowContent(windowItem.id)}</div>
            </article>
          ))}
      </section>

      <footer className="taskbar">
        {(Object.keys(appTemplates) as AppId[]).map((id) => {
          const win = windows.find((w) => w.id === id);
          if (!win) return null;
          const active = win.isOpen && !win.isMinimized;

          return (
            <button
              key={id}
              type="button"
              className={active ? 'active' : ''}
              onClick={() => {
                if (win.isOpen && !win.isMinimized) {
                  toggleMinimize(id);
                  return;
                }
                openWindow(id);
              }}
            >
              {win.title}
            </button>
          );
        })}
      </footer>
    </main>
  );
}

function renderWindowContent(id: AppId) {
  switch (id) {
    case 'terminal':
      return (
        <div>
          <p>&gt; boot sequence complete.</p>
          <p>&gt; command channel ready.</p>
          <p>&gt; use <strong>phish</strong> in phase 4 terminal engine.</p>
        </div>
      );
    case 'market':
      return <p>Black Market catalog will unlock in phase 5.</p>;
    case 'index':
      return <p>Command inventory and locked unlocks will appear here.</p>;
    case 'profile':
      return <p>Profile stats, badges, and progression UI are planned for phase 6.</p>;
    case 'settings':
      return <p>System audio, glow intensity, and accessibility toggles coming soon.</p>;
    default:
      return null;
  }
}
