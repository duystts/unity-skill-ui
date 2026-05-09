import { create } from 'zustand'

type UIMode = 'character' | 'serious'

interface UIState {
  sidebarOpen: boolean
  activeWorkspaceId: string | null
  mode: UIMode
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setActiveWorkspaceId: (id: string | null) => void
  setMode: (mode: UIMode) => void
  toggleMode: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: true,
  activeWorkspaceId: null,
  mode: 'character', // Default: character mode (FR22)
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((state) => ({
    mode: state.mode === 'character' ? 'serious' : 'character'
  })),
}))
