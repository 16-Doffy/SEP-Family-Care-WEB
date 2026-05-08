import { create } from 'zustand'

interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string | null
  role: string
  familyMember?: {
    id: string
    familyId: string
    family?: { id: string; name: string; plan: string }
  } | null
}

export interface AuthState {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  clearAuth: () => void
  setUser: (user: User) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    set({ user, accessToken, isLoading: false })
  },
  clearAuth: () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({ user: null, accessToken: null, isLoading: false })
  },
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}))
