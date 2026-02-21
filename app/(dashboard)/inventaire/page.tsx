'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ClipboardList, Loader2, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { MatierePremiere, LotPF, PaginatedResponse } from '@/types'
import { formatWeight } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { toast } from 'sonner'
import { AxiosError } from 'axios'

const schema = z.object({
  type: z.enum(['mp', 'pf']),
  cible_id: z.string().min(1, 'Sélectionnez une cible'),
  quantite: z.string().min(1, 'Quantité requise')
    .refine((v) => !isNaN(parseFloat(v)), 'Invalide'),
  justification: z.string().min(5, 'Justification requise (min. 5 caractères)'),
})

type FormData = z.infer<typeof schema>

export default function InventairePage() {
  const queryClient = useQueryClient()
  const [type, setType] = useState<'mp' | 'pf'>('mp')

  const { data: mpList, isLoading: loadingMP } = useQuery({
    queryKey: ['matieres-premieres-all'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<MatierePremiere>>('/matieres-premieres', {
        params: { limit: 200 },
      })
      return res.data.data
    },
  })

  const { data: lotsPF, isLoading: loadingPF } = useQuery({
    queryKey: ['lots-pf-all'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<LotPF>>('/lots-pf', { params: { limit: 200 } })
      return res.data.data
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'mp' },
  })

  const watchedType = watch('type')

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post('/stocks/ajustement', {
        ...(data.type === 'mp'
          ? { matiere_premiere_id: parseInt(data.cible_id) }
          : { lot_pf_id: parseInt(data.cible_id) }),
        quantite: parseFloat(data.quantite),
        justification: data.justification,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] })
      queryClient.invalidateQueries({ queryKey: ['matieres-premieres'] })
      queryClient.invalidateQueries({ queryKey: ['lots-pf-all'] })
      toast.success('Ajustement enregistré')
      reset({ type: watchedType })
    },
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'ajustement')
    },
  })

  return (
    <div className="max-w-lg space-y-5">
      {/* Warning */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          Tout ajustement de stock doit être <strong>justifié</strong>. Il sera tracé dans l&apos;historique.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <ClipboardList className="w-4.5 h-4.5 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-800">Ajustement de stock</h2>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Type de stock</label>
            <div className="grid grid-cols-2 gap-2">
              {(['mp', 'pf'] as const).map((t) => (
                <label key={t} className="relative cursor-pointer">
                  <input
                    {...register('type')}
                    type="radio"
                    value={t}
                    className="sr-only peer"
                    onChange={() => {
                      setValue('type', t)
                      setValue('cible_id', '')
                      setType(t)
                    }}
                  />
                  <div className="px-4 py-2.5 border border-slate-300 rounded-lg text-center text-sm font-medium text-slate-600 peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700 transition">
                    {t === 'mp' ? 'Matière Première' : 'Produit Fini'}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Cible */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {watchedType === 'mp' ? 'Matière première' : 'Lot produit fini'} <span className="text-red-500">*</span>
            </label>
            {loadingMP || loadingPF ? (
              <LoadingSpinner size="sm" className="p-2" />
            ) : (
              <select
                {...register('cible_id')}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="">Sélectionner...</option>
                {watchedType === 'mp'
                  ? mpList?.map((mp) => (
                      <option key={mp.id} value={mp.id}>
                        {mp.nom} — {formatWeight(mp.quantite)}
                      </option>
                    ))
                  : lotsPF?.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.formule?.nom ?? `Lot #${lot.id}`} — {formatWeight(lot.quantite_restante)}
                      </option>
                    ))}
              </select>
            )}
            {errors.cible_id && <p className="text-red-500 text-xs mt-1">{errors.cible_id.message}</p>}
          </div>

          {/* Quantité */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Quantité ajustée (kg) <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-400 mb-1.5">
              Entrez une valeur <strong>positive</strong> pour augmenter, <strong>négative</strong> pour diminuer.
            </p>
            <div className="relative">
              <input
                {...register('quantite')}
                type="number"
                step="0.01"
                placeholder="Ex: +50 ou -20"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition pr-10"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">kg</span>
            </div>
            {errors.quantite && <p className="text-red-500 text-xs mt-1">{errors.quantite.message}</p>}
          </div>

          {/* Justification */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register('justification')}
              rows={3}
              placeholder="Ex: Erreur de pesée lors de la réception, casse lors du stockage..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
            />
            {errors.justification && <p className="text-red-500 text-xs mt-1">{errors.justification.message}</p>}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {mutation.isPending ? 'Enregistrement...' : 'Valider l\'ajustement'}
          </button>
        </form>
      </div>
    </div>
  )
}
