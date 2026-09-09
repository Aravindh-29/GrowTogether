import { create } from 'zustand'
import type { AuthResponse } from '../api/authApi'

interface AuthState {
  token: string | null
  user: { userId: string; email: string; displayName: string } | null
  setAuth: (auth: AuthResponse) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('cs_token'),
  user: (() => {
    const raw = localStorage.getItem('cs_user')
    return raw ? JSON.parse(raw) : null
  })(),

  setAuth: (auth) => {
    localStorage.setItem('cs_token', auth.token)
    localStorage.setItem('cs_user', JSON.stringify({
      userId: auth.userId,
      email: auth.email,
      displayName: auth.displayName,
    }))
    set({ token: auth.token, user: { userId: auth.userId, email: auth.email, displayName: auth.displayName } })
  },

  clearAuth: () => {
    localStorage.removeItem('cs_token')
    localStorage.removeItem('cs_user')
    set({ token: null, user: null })
  },
}))
