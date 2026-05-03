import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../context/authStore';
import { getHomePathForRole } from '../constants/roleAccess';
import { CHURCH_NAME, CHURCH_LOCATION, PLATFORM_NAME, CHURCH_LOGO_SRC } from '../constants/branding';

const showDemoCredentials =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === 'true';

export default function LoginPage() {
  const [email, setEmail] = useState(showDemoCredentials ? 'admin@clci.org' : '');
  const [password, setPassword] = useState(showDemoCredentials ? 'GraceERP@2025' : '');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await login(email, password);
    if (res.success) {
      const role = useAuthStore.getState().user?.role;
      navigate(getHomePathForRole(role));
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sidebar-bg via-purple-950 to-sidebar-bg flex items-center justify-center p-4 font-body">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="mx-auto mb-6 flex justify-center">
            <img
              src={CHURCH_LOGO_SRC}
              alt={CHURCH_NAME}
              className="w-[min(92vw,24rem)] sm:w-[28rem] max-h-[min(42vh,15rem)] sm:max-h-[17rem] object-contain rounded-3xl bg-white p-5 sm:p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_25px_60px_-12px_rgba(0,0,0,0.65),0_0_80px_-20px_rgba(167,139,250,0.55)] ring-4 ring-purple-400/35"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2 leading-snug px-1 drop-shadow-md">
            {CHURCH_NAME}
          </h1>
          <p className="text-purple-300 text-sm">{CHURCH_LOCATION}</p>
          <p className="text-purple-500 text-xs mt-2">{PLATFORM_NAME}</p>
          <p className="text-purple-400/80 text-xs mt-1 italic">Pastor (Prof.) Anthony Adegbulugbe</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-purple-800/40 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-purple-300 mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-purple-900/30 border border-purple-700/50 rounded-lg px-4 py-3 text-white placeholder-purple-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 transition-colors text-sm"
                placeholder="admin@church.org"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-purple-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-purple-900/30 border border-purple-700/50 rounded-lg px-4 py-3 text-white placeholder-purple-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 transition-colors text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-lg shadow-purple-900/40"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-purple-900/20 border border-purple-800/30 rounded-lg">
            <p className="text-xs text-purple-400 font-medium mb-2 uppercase tracking-wider">Login credentials</p>
            <div className="space-y-1 text-xs text-purple-300">
              <div className="flex justify-between"><span>Email:</span><span className="font-mono">admin@clci.org</span></div>
              <div className="flex justify-between"><span>Password:</span><span className="font-mono">GraceERP@2025</span></div>
            </div>
          </div>
        </div>

        <p className="text-center text-purple-600 text-xs mt-6">
          {PLATFORM_NAME} v1.0 · Roland Consult / Agileware Technologies
        </p>
      </div>
    </div>
  );
}
