import {
  Auth,
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthService {
  createAccount(credentials: LoginCredentials): Promise<User>;
  login(credentials: LoginCredentials): Promise<User>;
  loginWithGoogle(): Promise<User>;
  logout(): Promise<void>;
  observeAuthState(onChange: (user: User | null) => void): () => void;
}

export const createAuthService = (auth: Auth): AuthService => {
  const provider = new GoogleAuthProvider();

  return {
    async createAccount({ email, password }) {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      return result.user;
    },

    async login({ email, password }) {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      return result.user;
    },

    async loginWithGoogle() {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    },

    async logout() {
      await signOut(auth);
    },

    observeAuthState(onChange) {
      return onAuthStateChanged(auth, onChange);
    },
  };
};
