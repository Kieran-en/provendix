'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Info } from 'lucide-react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { MatierePremiere, PaginatedResponse } from '@/types'
import { AxiosError } from 'axios'
import { useWatch } from 'react-hook-form'
import { formatCurrency, getCurrencyLabel } from '@/lib/utils'

const schema = z.object({
  matiere_premiere_id: z.string().min(1, 'Sélectionnez une matière première'),
  quantite_initiale: z
    .string()
    .min(1, 'Quantité requise')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Quantité invalide'),
  cout_kg: z
    .string()
    .min(1, 'Coût requis')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Coût invalide'),
})

type FormData = z.infer<typeof schema>

export default function NouveauLotPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: mpData } = useQuery({
    queryKey: ['matieres-premieres-all'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<MatierePremiere>>('/matieres-premieres', {
        params: { limit: 200 },
      })
      return res.data.data
    },
  })

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const quantite = useWatch({ control, name: 'quantite_initiale' })
  const coutKg = useWatch({ control, name: 'cout_kg' })
  const coutTotal =
    parseFloat(quantite) > 0 && parseFloat(coutKg) > 0
      ? parseFloat(quantite) * parseFloat(coutKg)
      : null

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post('/lots-fournisseurs', {
        matiere_premiere_id: parseInt(data.matiere_premiere_id),
        quantite_initiale: parseFloat(data.quantite_initiale),
        cout_kg: parseFloat(data.cout_kg),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lots-fournisseurs'] })
      queryClient.invalidateQueries({ queryKey: ['matieres-premieres'] })
      toast.success('Lot fournisseur créé — stock mis à jour')
      router.push('/lots-fournisseurs')
    },
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur lors de la création')
    },
  })

  return (
    <div className="max-w-lg">
      <Link
        href="/lots-fournisseurs"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux lots
      </Link>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Réception matière première</h2>
        <p className="text-xs text-slate-400 mb-5">
          La création d&apos;un lot met à jour automatiquement le stock de la MP.
        </p>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Matière première <span className="text-red-500">*</span>
            </label>
            <select
              {...register('matiere_premiere_id')}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            >
              <option value="">Sélectionner une MP...</option>
              {mpData?.map((mp) => (
                <option key={mp.id} value={mp.id}>
                  {mp.nom}
                </option>
              ))}
            </select>
            {errors.matiere_premiere_id && (
              <p className="text-red-500 text-xs mt-1">{errors.matiere_premiere_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Quantité reçue (kg) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                {...register('quantite_initiale')}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition pr-10"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">kg</span>
            </div>
            {errors.quantite_initiale && (
              <p className="text-red-500 text-xs mt-1">{errors.quantite_initiale.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Coût d&apos;achat ({getCurrencyLabel()}/kg) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                {...register('cout_kg')}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition pr-16"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{getCurrencyLabel()}/kg</span>
            </div>
            {errors.cout_kg && (
              <p className="text-red-500 text-xs mt-1">{errors.cout_kg.message}</p>
            )}
          </div>

          {/* Calcul automatique coût total */}
          {coutTotal !== null && (
            <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-3">
              <Info className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  Coût total du lot : {formatCurrency(coutTotal)}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {parseFloat(quantite).toFixed(2)} kg × {formatCurrency(parseFloat(coutKg))}/kg
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link
              href="/lots-fournisseurs"
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition text-center"
            >
              Annuler
            </Link>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer le lot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
