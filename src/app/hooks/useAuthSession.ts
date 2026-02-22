import { FormEvent, useEffect, useRef, useState } from 'react';
import { User, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, authPersistenceReady } from '../../config/firebase';

export type AppPhase = 'boot' | 'login' | 'desktop';

export function useAuthSession() {
  const [phase, setPhase] = useState<AppPhase>('boot');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const prevAuthUidRef = useRef<string | null>(null);

  useEffect(() => {
    let unsub: () => void = () => {};
    void authPersistenceReady.then(() => {
      unsub = onAuthStateChanged(auth, (nextUser) => {
        prevAuthUidRef.current = nextUser?.uid ?? null;
        setUser(nextUser);
        setAuthReady(true);
        setPhase(nextUser ? 'desktop' : 'login');
      });
    });

    return () => unsub();
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOutSession() {
    await signOut(auth);
  }

  return {
    phase,
    setPhase,
    email,
    setEmail,
    password,
    setPassword,
    authMode,
    setAuthMode,
    authError,
    setAuthError,
    authLoading,
    user,
    authReady,
    prevAuthUidRef,
    submitAuth,
    signOutSession
  };
}
