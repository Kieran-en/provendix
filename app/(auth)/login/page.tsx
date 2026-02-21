'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Wheat } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { LoginResponse } from '@/types'
import { AxiosError } from 'axios'

const schema = z.object({
  login: z.string().min(1, 'Identifiant requis'),
  mot_de_passe: z.string().min(1, 'Mot de passe requis'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post<LoginResponse>('/auth/login', data)
      login(res.data.user, res.data.access_token, res.data.refresh_token)
      toast.success(`Bienvenue, ${res.data.user.nom}`)
      router.push('/dashboard')
    } catch (err) {
      const e = err as AxiosError<{ error: string }>
      toast.error(e.response?.data?.error || 'Identifiants incorrects')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-600 rounded-2xl mb-4">
            <Wheat className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">PROVENDIX</h1>
          <p className="text-slate-500 text-sm mt-1">Gestion de provenderie</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">Connexion</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Identifiant
              </label>
              <input
                {...register('login')}
                type="text"
                placeholder="Votre identifiant"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              {errors.login && (
                <p className="text-red-500 text-xs mt-1">{errors.login.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Mot de passe
              </label>
              <input
                {...register('mot_de_passe')}
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              {errors.mot_de_passe && (
                <p className="text-red-500 text-xs mt-1">{errors.mot_de_passe.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg text-sm transition flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
