import api from './api';
import useAuthStore from '../context/authStore';
import useBranchScopeStore from '../context/branchScopeStore';

/**
 * Runs after api.js JWT interceptor. Avoid importing authStore from api.js (circular dependency).
 */
api.interceptors.request.use((config) => {
  const user = useAuthStore.getState().user;
  if (!user || user.role !== 'super_admin') return config;

  const selected = useBranchScopeStore.getState().selectedBranchId;
  if (!selected) return config;

  const params = config.params ?? {};
  if (Object.prototype.hasOwnProperty.call(params, 'branch_id')) return config;

  config.params = { ...params, branch_id: selected };
  return config;
});
