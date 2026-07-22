'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BarChart3, Eye, EyeOff, Loader2, PackageCheck, ShieldCheck } from 'lucide-react'
import { AxiosError } from 'axios'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { LoginResponse } from '@/types'
import BrandMark from '@/components/ui/BrandMark'

const schema = z.object({
  login: z.string().trim().min(1, 'Identifiant requis'),
  mot_de_passe: z.string().min(1, 'Mot de passe requis'),
})

type FormData = z.infer<typeof schema>

const benefits = [
  { icon: PackageCheck, title: 'Stocks maîtrisés', text: 'Suivez les matières, lots et produits en temps réel.' },
  { icon: BarChart3, title: 'Décisions éclairées', text: "Analysez les ventes, les marges et l'activité." },
  { icon: ShieldCheck, title: 'Opérations traçables', text: 'Chaque mouvement important reste contrôlé et auditable.' },
]

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post<LoginResponse>('/auth/login', data)
      login(res.data.user, res.data.settings)
      toast.success(`Bienvenue, ${res.data.user.nom}`)
      router.push('/dashboard')
    } catch (err) {
      const error = err as AxiosError<{ error: string }>
      toast.error(error.response?.data?.error || 'Identifiants incorrects')
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7f5] p-3 sm:p-5 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1480px] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_30px_80px_-35px_rgba(15,23,42,0.32)] sm:min-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.32),transparent_34%),radial-gradient(circle_at_90%_85%,rgba(217,155,43,0.20),transparent_30%)]" />
          <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full border border-emerald-400/10" />
          <div className="absolute -bottom-10 -right-10 h-52 w-52 rounded-full border border-emerald-400/10" />

          <div className="relative flex items-center gap-3">
            <BrandMark className="h-11 w-11" iconClassName="h-6 w-6" />
            <div>
              <p className="text-lg font-extrabold tracking-[0.12em]">PROVENDIX</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">Gestion avicole</p>
            </div>
          </div>

          <div className="relative max-w-xl py-12">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Votre activité, clairement pilotée</p>
            <h1 className="text-4xl font-extrabold leading-[1.12] tracking-tight xl:text-5xl">
              De la matière première à la vente finale.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              Une vue fiable de vos stocks, productions et ventes pour travailler plus vite et prendre de meilleures décisions.
            </p>

            <div className="mt-10 grid gap-4 xl:grid-cols-3">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                  <benefit.icon className="h-5 w-5 text-emerald-400" />
                  <h2 className="mt-3 text-sm font-bold">{benefit.title}</h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-400">{benefit.text}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="relative text-xs text-slate-500">Sécurisé · Traçable · Adapté à votre activité</p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <BrandMark className="h-11 w-11" iconClassName="h-6 w-6" />
              <div>
                <p className="font-extrabold tracking-[0.1em] text-slate-950">PROVENDIX</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-700">Gestion avicole</p>
              </div>
            </div>

            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Espace sécurisé</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Ravi de vous revoir</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Connectez-vous pour accéder à votre espace de gestion.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Identifiant</span>
                <input
                  {...register('login')}
                  type="text"
                  placeholder="Votre identifiant"
                  autoComplete="username"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm shadow-slate-100 transition placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                />
                {errors.login && <span className="mt-1.5 block text-xs font-medium text-rose-600">{errors.login.message}</span>}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Mot de passe</span>
                <span className="relative block">
                  <input
                    {...register('mot_de_passe')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-950 shadow-sm shadow-slate-100 transition placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
                {errors.mot_de_passe && <span className="mt-1.5 block text-xs font-medium text-rose-600">{errors.mot_de_passe.message}</span>}
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-600/25 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>

            <p className="mt-8 text-center text-xs leading-5 text-slate-400">
              Vos accès sont personnels. Ne communiquez jamais votre mot de passe.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
