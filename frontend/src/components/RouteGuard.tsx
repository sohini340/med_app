import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface RouteGuardProps {
  children: ReactNode;
  allowedRoles: string[];
}

export const RouteGuard = ({ children, allowedRoles }: RouteGuardProps) => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.status === 'blocked') {
    useAuthStore.getState().logout();
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
};
