import { Outlet, NavLink, useNavigate, Link, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import useBranchScopeStore from '../context/branchScopeStore';
import { branchesAPI, pastoralAPI } from '../services/api';
import { CHURCH_NAME, CHURCH_LOCATION, CHURCH_LOGO_SRC } from '../constants/branding';
import { canAccessRoute, pathToSegment } from '../constants/roleAccess';
import { Spinner } from './UI';

const navItems = [
  { section: 'Core', links: [
    { to: '/dashboard',   icon: '⬡', label: 'Dashboard' },
    { to: '/members',     icon: '👥', label: 'Members' },
    { to: '/branches',    icon: '🏛', label: 'Branch Management' },
    { to: '/access',      icon: '🔐', label: 'Roles & Access' },
  ]},
  { section: 'Finance', links: [
    { to: '/finance',  icon: '💰', label: 'Finance & Giving' },
    { to: '/budget',   icon: '📊', label: 'Budget & Expenditure' },
    { to: '/audit',    icon: '📋', label: 'Audit & Reports' },
  ]},
  { section: 'Digital Ministry', links: [
    { to: '/sermons',  icon: '🎙', label: 'Sermon Repository' },
    { to: '/library',  icon: '📚', label: 'E-Library' },
    { to: '/meetings', icon: '📡', label: 'Live Meetings', badge: 'LIVE' },
  ]},
  { section: 'Operations', links: [
    { to: '/assets',     icon: '🏗', label: 'Asset Management' },
    { to: '/facilities', icon: '🗓', label: 'Facility Booking' },
    { to: '/projects',   icon: '📐', label: 'Projects' },
    { to: '/hr',         icon: '🤝', label: 'HR & Staff' },
  ]},
  { section: 'Pastoral', links: [
    { to: '/communications', icon: '📣', label: 'Communication Hub' },
    { to: '/pastoral',       icon: '🙏', label: 'Pastoral Care' },
    { to: '/member-inbox',   icon: '💬', label: 'Member chat inbox' },
    { to: '/events',         icon: '🎟', label: 'Events & Programmes' },
  ]},
  { section: 'Administration', links: [
    { to: '/documents', icon: '🗂', label: 'Documents' },
    { to: '/analytics', icon: '📈', label: 'Analytics & Reports' },
  ]},
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const selectedBranchId = useBranchScopeStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useBranchScopeStore((s) => s.setSelectedBranchId);
  const [branchRows, setBranchRows] = useState([]);
  const [pastoralOpenCount, setPastoralOpenCount] = useState(null);
  const isSuper = user?.role === 'super_admin';
  const settingsTo = ['super_admin', 'branch_admin'].includes(user?.role) ? '/access' : '/dashboard';

  useEffect(() => {
    if (!isSuper) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await branchesAPI.getAll({ limit: 500 });
        if (!cancelled) setBranchRows(res.data?.data ?? []);
      } catch {
        if (!cancelled) setBranchRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuper]);

  useEffect(() => {
    if (!canAccessRoute(user?.role, 'pastoral')) {
      setPastoralOpenCount(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await pastoralAPI.summary();
        const n = res.data?.data?.open_total;
        if (!cancelled) setPastoralOpenCount(typeof n === 'number' ? n : 0);
      } catch {
        if (!cancelled) setPastoralOpenCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBranchId, user?.role]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }

  if (user.role === 'member') {
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="flex h-screen bg-gray-50 font-body overflow-hidden">
      {/* SIDEBAR - Hidden on mobile, shown on md+ screens */}
      <aside className="hidden md:flex w-64 flex-shrink-0 bg-sidebar-bg flex-col overflow-y-auto">
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border">
          <div className="mb-4 flex justify-center">
            <img
              src={CHURCH_LOGO_SRC}
              alt={CHURCH_NAME}
              className="w-full max-h-[8.5rem] object-contain rounded-2xl bg-white p-3 shadow-[0_18px_40px_-15px_rgba(0,0,0,0.55)] ring-[3px] ring-purple-400/35"
            />
          </div>
          <h2 className="text-xs font-semibold text-purple-100 font-display leading-snug">{CHURCH_NAME}</h2>
          <p className="text-xs text-purple-400 mt-1">{CHURCH_LOCATION}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4">
          {navItems.map(({ section, links }) => {
            const visibleLinks = links.filter((link) =>
              canAccessRoute(user?.role, pathToSegment(link.to))
            );
            if (!visibleLinks.length) return null;
            return (
            <div key={section}>
              <p className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-purple-500">
                {section}
              </p>
              {visibleLinks
                .map(({ to, icon, label, badge }) => {
                  let navBadge = badge;
                  if (to === '/pastoral' && pastoralOpenCount != null && pastoralOpenCount > 0) {
                    navBadge = pastoralOpenCount > 99 ? '99+' : String(pastoralOpenCount);
                  } else if (to === '/pastoral') {
                    navBadge = undefined;
                  }
                  return (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 ${
                      isActive
                        ? 'bg-purple-700/30 text-purple-200 border border-purple-500/30'
                        : 'text-purple-400 hover:bg-purple-800/40 hover:text-purple-200'
                    }`
                  }
                >
                  <span className="text-base w-5 text-center">{icon}</span>
                  <span className="flex-1">{label}</span>
                  {navBadge && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      navBadge === 'LIVE' ? 'bg-red-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {navBadge}
                    </span>
                  )}
                </NavLink>
                  );
                })}
            </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-700 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-purple-100 truncate">{user?.full_name}</p>
              <p className="text-xs text-purple-400 truncate capitalize">{user?.role?.replace('_', ' ')} · {user?.branch_name}</p>
            </div>
            <button onClick={handleLogout} className="text-purple-400 hover:text-purple-200 text-sm" title="Logout">
              ⏏
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE SIDEBAR OVERLAY */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      {/* MOBILE SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-bg flex flex-col overflow-y-auto transform transition-transform duration-300 ease-in-out md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border">
          <div className="mb-4 flex justify-center">
            <img
              src={CHURCH_LOGO_SRC}
              alt={CHURCH_NAME}
              className="w-full max-h-[8.5rem] object-contain rounded-2xl bg-white p-3 shadow-[0_18px_40px_-15px_rgba(0,0,0,0.55)] ring-[3px] ring-purple-400/35"
            />
          </div>
          <h2 className="text-xs font-semibold text-purple-100 font-display leading-snug">{CHURCH_NAME}</h2>
          <p className="text-xs text-purple-400 mt-1">{CHURCH_LOCATION}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4">
          {navItems.map(({ section, links }) => {
            const visibleLinks = links.filter((link) =>
              canAccessRoute(user?.role, pathToSegment(link.to))
            );
            if (!visibleLinks.length) return null;
            return (
            <div key={section}>
              <p className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-purple-500">
                {section}
              </p>
              {visibleLinks
                .map(({ to, icon, label, badge }) => {
                  let navBadge = badge;
                  if (to === '/pastoral' && pastoralOpenCount != null && pastoralOpenCount > 0) {
                    navBadge = pastoralOpenCount > 99 ? '99+' : String(pastoralOpenCount);
                  } else if (to === '/pastoral') {
                    navBadge = undefined;
                  }
                  return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 ${
                      isActive
                        ? 'bg-purple-700/30 text-purple-200 border border-purple-500/30'
                        : 'text-purple-400 hover:bg-purple-800/40 hover:text-purple-200'
                    }`
                  }
                >
                  <span className="text-base w-5 text-center">{icon}</span>
                  <span className="flex-1">{label}</span>
                  {navBadge && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      navBadge === 'LIVE' ? 'bg-red-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {navBadge}
                    </span>
                  )}
                </NavLink>
                  );
                })}
            </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-700 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-purple-100 truncate">{user?.full_name}</p>
              <p className="text-xs text-purple-400 truncate capitalize">{user?.role?.replace('_', ' ')} · {user?.branch_name}</p>
            </div>
            <button onClick={handleLogout} className="text-purple-400 hover:text-purple-200 text-sm" title="Logout">
              ⏏
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-4 shadow-sm flex-shrink-0">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden w-10 h-10 flex items-center justify-center text-gray-600 hover:text-purple-600"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold font-display text-gray-800">
              {user?.church_name || CHURCH_NAME}
            </h1>
          </div>

          {isSuper ? (
            <select
              value={selectedBranchId ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedBranchId(v === '' ? null : v);
              }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 text-gray-600 focus:outline-none focus:border-purple-400 max-w-[min(22rem,44vw)]"
              title="Scope dashboards and lists (super admin)"
            >
              <option value="">All congregations (aggregated)</option>
              {branchRows.map((b) => (
                <option key={b.id} value={b.id}>
                  {(b.is_headquarters ? '🏛 ' : '📍 ') + b.name + (b.city ? ` · ${b.city}` : '')}
                </option>
              ))}
            </select>
          ) : (
            <div
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 text-gray-600 max-w-[min(22rem,44vw)] truncate"
              title="Your assigned congregation"
            >
              📍 {user?.branch_name || 'Your congregation'}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Link
              to="/communications"
              title="Communication Hub"
              className="w-9 h-9 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors relative"
            >
              🔔
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" aria-hidden />
            </Link>
            <Link
              to="/members"
              title="Members directory"
              className="w-9 h-9 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
            >
              🔍
            </Link>
            <Link
              to={settingsTo}
              title={settingsTo === '/access' ? 'Roles & access' : 'Dashboard'}
              className="w-9 h-9 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
            >
              ⚙️
            </Link>
            <Link
              to="/dashboard"
              title="Dashboard"
              className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-700 flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:ring-2 hover:ring-purple-300/50"
            >
              {initials}
            </Link>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
