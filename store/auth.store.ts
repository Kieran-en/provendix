import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'
import { setCurrencyCode, type CurrencyCode } from '@/lib/utils'

interface LoginSettings {
  currency_code: CurrencyCode
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (user: User, settings: LoginSettings) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: (user, settings) => {
        setCurrencyCode(settings.currency_code)
        set({ user, isAuthenticated: true })
      },

      logout: () => {
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'provendix-user',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
