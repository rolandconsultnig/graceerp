import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Global branch filter for super_admin (merged into API query params via interceptor).
 * null = all congregations (aggregated).
 */
const useBranchScopeStore = create(
  persist(
    (set) => ({
      selectedBranchId: null,

      setSelectedBranchId: (id) => set({ selectedBranchId: id }),

      syncFromUser: (user) => {
        if (!user) return;
        if (user.role !== 'super_admin') {
          set({ selectedBranchId: user.branch_id ?? null });
        }
      },

      resetForLogout: () => set({ selectedBranchId: null }),
    }),
    {
      name: 'graceerp-branch-scope',
      partialize: (s) => ({ selectedBranchId: s.selectedBranchId }),
    }
  )
);

export default useBranchScopeStore;
