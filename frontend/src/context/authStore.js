import { create } from 'zustand';
import { authAPI } from '../services/api';
import useBranchScopeStore from './branchScopeStore';

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('graceerp_token'),
  isLoading: false,
  isAuthenticated: !!localStorage.getItem('graceerp_token'),

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await authAPI.login({ email, password });
      const { token, refreshToken, user } = res.data.data;

      localStorage.setItem('graceerp_token', token);
      localStorage.setItem('graceerp_refresh', refreshToken);

      set({ user, token, isAuthenticated: true, isLoading: false });
      useBranchScopeStore.getState().syncFromUser(user);
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      const status = err.response?.status;
      const apiMsg = err.response?.data?.message;
      const message =
        apiMsg ||
        (status === 503
          ? 'Cannot connect to the database. Check backend/.env DB_* settings and run npm run migrate && npm run seed.'
          : null) ||
        (status === 401 ? 'Invalid email or password.' : null) ||
        (!err.response && (err.code === 'ECONNABORTED' || err.message === 'Network Error')
          ? 'Cannot reach the API. Start the backend (npm run dev) and confirm VITE_API_URL / proxy.'
          : null) ||
        err.message ||
        'Login failed';
      return { success: false, message };
    }
  },

  logout: async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.removeItem('graceerp_token');
    localStorage.removeItem('graceerp_refresh');
    useBranchScopeStore.getState().resetForLogout();
    set({ user: null, token: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    try {
      const res = await authAPI.me();
      const nextUser = res.data.data;
      set({ user: nextUser, isAuthenticated: true });
      useBranchScopeStore.getState().syncFromUser(nextUser);
    } catch {
      get().logout();
    }
  },

  hasRole: (...roles) => {
    const { user } = get();
    return user && roles.includes(user.role);
  },
}));

export default useAuthStore;
