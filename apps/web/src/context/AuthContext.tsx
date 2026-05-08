'use client'
import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useAuthStore, type AuthState } from '@/store/auth.store'
import { api } from '@/lib/api'

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useAuthStore()

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      store.setLoading(false)
      return
    }
    api.get('/auth/me')
      .then(({ data }) => {
        store.setUser(data)
        store.setAuth(data, token, localStorage.getItem('refreshToken') ?? '')
      })
      .catch(() => {
        store.clearAuth()
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
