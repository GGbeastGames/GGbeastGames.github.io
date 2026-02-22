import { FormEvent, useMemo, useState } from 'react';

import { AuthService } from '../../services/auth/AuthService';

interface AuthGateProps {
  authService: AuthService;
}

export const AuthGate = ({ authService }: AuthGateProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [error, setError] = useState<string | null>(null);
  const submitLabel = useMemo(() => (mode === 'login' ? 'Log in' : 'Create account'), [mode]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      if (mode === 'login') {
        await authService.login({ email, password });
        return;
      }

      await authService.createAccount({ email, password });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    }
  };

  return (
    <section>
      <h1>{submitLabel}</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="submit">{submitLabel}</button>
      </form>
      <button type="button" onClick={() => authService.loginWithGoogle()}>
        Continue with Google
      </button>
      <button type="button" onClick={() => setMode(mode === 'login' ? 'create' : 'login')}>
        {mode === 'login' ? 'Need an account?' : 'Already have an account?'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
};
