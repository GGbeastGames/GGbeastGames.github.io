import { User } from 'firebase/auth';

export const assertAuthenticated = (user: User | null): User => {
  if (!user) {
    throw new Error('Unauthenticated session: protected route access blocked.');
  }

  return user;
};

export const canAccessProtectedRoute = (user: User | null, routePath: string) => {
  const publicRoutes = new Set(['/login', '/create-account', '/recover', '/legal']);

  if (publicRoutes.has(routePath)) {
    return true;
  }

  return Boolean(user);
};
