import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { AppShell } from '../layouts/AppShell.jsx';
import { getRoleHomePath } from './routes.js';

export function ProtectedRoute({ allowedRoles, children }) {
  const { session } = useAuth();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (Array.isArray(allowedRoles) && !allowedRoles.includes(session.user.role)) {
    return <Navigate to={getRoleHomePath(session.user.role)} replace />;
  }

  return <AppShell>{children}</AppShell>;
}
