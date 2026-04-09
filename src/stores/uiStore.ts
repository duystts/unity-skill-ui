import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  activeWorkspaceId: string | null
  isCharacterMode: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setActiveWorkspaceId: (id: string | null) => void
  setCharacterMode: (enabled: boolean) => void
  toggleCharacterMode: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: true,
  activeWorkspaceId: null,
  isCharacterMode: true, // Default: character mode on (FR22)
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  setCharacterMode: (enabled) => set({ isCharacterMode: enabled }),
  toggleCharacterMode: () => set((state) => ({ isCharacterMode: !state.isCharacterMode })),
}))
