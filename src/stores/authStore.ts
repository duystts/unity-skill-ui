import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  setUser: (user: User | null) => void
  setAccessToken: (token: string | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setUser: (user) => set({ user }),
      setAccessToken: (token) => set({ accessToken: token }),
      clearAuth: () => set({ user: null, accessToken: null }),
    }),
    {
      name: 'auth-storage',
      // Do NOT persist accessToken — it expires in 15min; refresh cookie handles renewal
      partialize: (state) => ({ user: state.user }),
    }
  )
)
