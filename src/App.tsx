import { AuthGate } from './features/auth/AuthGate';
import { AuthService } from './services/auth/AuthService';

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
  return <AuthGate authService={createLocalAuthService()} />;
};
