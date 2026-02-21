import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (user: User, access_token: string, refresh_token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: (user, access_token, refresh_token) => {
        localStorage.setItem('access_token', access_token)
        localStorage.setItem('refresh_token', refresh_token)
        // Aussi en cookie pour le middleware Next.js
        document.cookie = `access_token=${access_token}; path=/; max-age=900`
        document.cookie = `user_role=${user.role}; path=/; max-age=604800`
        set({ user, isAuthenticated: true })
      },

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        document.cookie = 'access_token=; path=/; max-age=0'
        document.cookie = 'user_role=; path=/; max-age=0'
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'provendix-user',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
