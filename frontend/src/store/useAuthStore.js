import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),

      // Helpers
      isAdmin: () => useAuthStore.getState().user?.role === 'ADMIN',
      isAssetManager: () => ['ADMIN', 'ASSET_MANAGER'].includes(useAuthStore.getState().user?.role),
      isDeptHead: () => ['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD'].includes(useAuthStore.getState().user?.role),
    }),
    { name: 'assetflow-auth' }
  )
);
