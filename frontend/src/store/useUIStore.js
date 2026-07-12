import { create } from 'zustand';

export const useUIStore = create((set) => ({
  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Active filters per page (keyed by page name)
  activeFilters: {},
  setFilter: (page, key, value) =>
    set((s) => ({
      activeFilters: {
        ...s.activeFilters,
        [page]: { ...(s.activeFilters[page] || {}), [key]: value },
      },
    })),
  clearFilters: (page) =>
    set((s) => ({ activeFilters: { ...s.activeFilters, [page]: {} } })),
}));
