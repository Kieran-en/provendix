'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Users, Trash2, KeyRound, Loader2, Shield, User } from 'lucide-react'
import api from '@/lib/api'
import { Utilisateur, PaginatedResponse } from '@/types'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { useAuthStore } from '@/store/auth.store'

const createSchema = z.object({
  nom: z.string().min(2, 'Nom requis'),
  login: z.string().min(3, 'Login requis (min. 3 caractères)'),
  mot_de_passe: z.string().min(6, 'Mot de passe requis (min. 6 caractères)'),
  role: z.enum(['gerant', 'superviseur']),
})
type CreateFormData = z.infer<typeof createSchema>

export default function UtilisateursPage() {
  const { user: currentUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Utilisateur>>('/users', {
        params: { limit: 100 },
      })
      return res.data
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'gerant' },
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateFormData) => api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utilisateurs'] })
      toast.success('Utilisateur créé')
      reset()
      setShowForm(false)
    },
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur lors de la création')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utilisateurs'] })
      toast.success('Utilisateur supprimé')
    },
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur')
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, mot_de_passe }: { id: number; mot_de_passe: string }) =>
      api.patch(`/users/${id}/reset-password`, { mot_de_passe }),
    onSuccess: () => toast.success('Mot de passe réinitialisé'),
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur')
    },
  })

  const handleDelete = (id: number, nom: string) => {
    if (id === currentUser?.id) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte')
      return
    }
    if (confirm(`Supprimer l'utilisateur "${nom}" ?`)) {
      deleteMutation.mutate(id)
    }
  }

  const handleResetPassword = (id: number) => {
    const newPassword = prompt('Nouveau mot de passe (min. 6 caractères) :')
    if (!newPassword || newPassword.length < 6) {
      toast.error('Mot de passe trop court')
      return
    }
    resetPasswordMutation.mutate({ id, mot_de_passe: newPassword })
  }

  const items = data?.data ?? []

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.length} utilisateur{items.length > 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Nouvel utilisateur
        </button>
      </div>

      {/* Formulaire de création */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Créer un utilisateur</h3>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nom *</label>
                <input {...register('nom')} placeholder="Prénom Nom"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                {errors.nom && <p className="text-red-500 text-xs mt-0.5">{errors.nom.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Login *</label>
                <input {...register('login')} placeholder="identifiant"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                {errors.login && <p className="text-red-500 text-xs mt-0.5">{errors.login.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mot de passe *</label>
                <input {...register('mot_de_passe')} type="password" placeholder="••••••"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                {errors.mot_de_passe && <p className="text-red-500 text-xs mt-0.5">{errors.mot_de_passe.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Rôle *</label>
                <select {...register('role')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                  <option value="gerant">Gérant</option>
                  <option value="superviseur">Superviseur</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowForm(false); reset() }}
                className="flex-1 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition">
                Annuler
              </button>
              <button type="submit" disabled={createMutation.isPending}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
                {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title="Aucun utilisateur" />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {items.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-4">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${u.role === 'superviseur' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                {u.role === 'superviseur'
                  ? <Shield className="w-4 h-4 text-purple-600" />
                  : <User className="w-4 h-4 text-blue-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800">{u.nom}</p>
                  {u.id === currentUser?.id && (
                    <span className="text-xs text-slate-400">(vous)</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono">{u.login}</p>
              </div>
              <Badge
                label={u.role === 'superviseur' ? 'Superviseur' : 'Gérant'}
                variant={u.role === 'superviseur' ? 'info' : 'default'}
              />
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => handleResetPassword(u.id)}
                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
                  title="Réinitialiser le mot de passe"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                {u.id !== currentUser?.id && (
                  <button
                    onClick={() => handleDelete(u.id, u.nom)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
