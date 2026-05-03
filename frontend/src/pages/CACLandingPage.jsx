import { Link, Navigate } from 'react-router-dom';
import useAuthStore from '../context/authStore';
import { getHomePathForRole } from '../constants/roleAccess';
import { Spinner } from '../components/UI';

export default function CACLandingPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (isAuthenticated && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F0816]">
        <Spinner />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
  }

  const base = import.meta.env.BASE_URL || '/';
  const landingSrc = `${base.endsWith('/') ? base : `${base}/`}cac-landing.html`;

  return (
    <div className="relative w-full min-h-screen h-screen bg-[#0F0816]">
      <iframe title="Christ Apostolic Church" src={landingSrc} className="absolute inset-0 w-full h-full border-0" />
      {/* Bottom-right: avoids the landing page fixed topbar (nav + Give Online) */}
      <div className="absolute bottom-5 right-5 sm:bottom-8 sm:right-8 z-10 flex flex-col items-end gap-1 pointer-events-none">
        <span
          className="pointer-events-none hidden text-[10px] uppercase tracking-[0.2em] text-[#E8C46A]/90 sm:block"
          style={{ fontFamily: "'Cinzel', Georgia, serif" }}
        >
          GraceERP
        </span>
        <Link
          to="/login"
          className="pointer-events-auto inline-flex items-center rounded-lg px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0F0816] shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-1 ring-[#C9973A]/40 transition hover:brightness-105 active:scale-[0.98] sm:text-xs sm:px-5"
          style={{
            background: 'linear-gradient(135deg, #E8C46A, #C9973A)',
            fontFamily: "'Cinzel', Georgia, serif",
          }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
