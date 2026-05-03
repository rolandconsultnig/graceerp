import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import useAuthStore from '../context/authStore';
import { CHURCH_NAME, CHURCH_LOGO_SRC, CHURCH_LOCATION } from '../constants/branding';
import { Spinner } from './UI';

export default function PortalLayout() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  if (!isAuthenticated) return null;
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (user.role !== 'member') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'M';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={CHURCH_LOGO_SRC}
              alt=""
              className="h-12 w-12 object-contain rounded-xl border border-gray-100 flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{CHURCH_NAME}</p>
              <p className="text-xs text-gray-500 truncate">{CHURCH_LOCATION}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-800 truncate max-w-[10rem]">{user?.full_name}</p>
              <p className="text-xs text-gray-500">Member portal</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-purple-800 text-white text-xs font-bold flex items-center justify-center">
              {initials}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-purple-400 hover:text-purple-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
