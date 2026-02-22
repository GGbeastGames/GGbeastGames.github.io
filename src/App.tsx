import { AuthGate } from './features/auth/AuthGate';
import { CompetitiveArena } from './features/pvp/CompetitiveArena';
import { AuthService } from './services/auth/AuthService';
import './features/pvp/competitive-arena.css';

const createLocalAuthService = (): AuthService => ({
  async createAccount() {
    return { uid: 'local-user' } as never;
  },
  async login() {
    return { uid: 'local-user' } as never;
  },
  async loginWithGoogle() {
    return { uid: 'local-user' } as never;
  },
  async logout() {
    return;
  },
  observeAuthState(onChange) {
    onChange(null);
    return () => undefined;
  },
});

export const App = () => {
  return (
    <>
      <CompetitiveArena />
      <AuthGate authService={createLocalAuthService()} />
    </>
  );
};
