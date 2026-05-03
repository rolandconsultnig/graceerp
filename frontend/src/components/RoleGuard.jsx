import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../context/authStore';
import { canAccessRoute, getHomePathForRole, pathToSegment } from '../constants/roleAccess';
import { Spinner } from './UI';

/**
 * Restricts staff app routes by role. Members are sent to /portal.
 */
export default function RoleGuard({ segment, children }) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }
  if (user.role === 'member') {
    return <Navigate to="/portal" replace />;
  }
  const key = segment || pathToSegment(location.pathname);
  if (!canAccessRoute(user.role, key)) {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
  }
  return children;
}
