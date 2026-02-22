import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';

import { canAccessProtectedRoute } from '../../services/auth/sessionGuard';

interface ProtectedRouteProps {
  user: User | null;
  children: ReactNode;
}

export const ProtectedRoute = ({ user, children }: ProtectedRouteProps) => {
  const location = useLocation();

  if (!canAccessProtectedRoute(user, location.pathname)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
