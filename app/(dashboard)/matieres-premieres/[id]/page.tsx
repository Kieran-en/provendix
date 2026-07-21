'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { MatierePremiere } from '@/types'
import { AxiosError } from 'axios'
import { useEffect } from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { getCurrencyLabel } from '@/lib/utils'

const schema = z.object({
  nom: z.string().min(2, 'Nom requis (min. 2 caractères)'),
  prix_kg: z
    .string()
    .min(1, 'Prix requis')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Prix invalide'),
})

type FormData = z.infer<typeof schema>

export default function EditMPPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: mp, isLoading } = useQuery({
    queryKey: ['matiere-premiere', id],
    queryFn: async () => {
      const res = await api.get<MatierePremiere>(`/matieres-premieres/${id}`)
      return res.data
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (mp) {
      reset({ nom: mp.nom, prix_kg: String(mp.prix_achat_moyen) })
    }
  }, [mp, reset])

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.put(`/matieres-premieres/${id}`, {
        nom: data.nom,
        prix_achat: parseFloat(data.prix_kg),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matieres-premieres'] })
      queryClient.invalidateQueries({ queryKey: ['matiere-premiere', id] })
      toast.success('Matière première mise à jour')
      router.push('/matieres-premieres')
    },
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur lors de la mise à jour')
    },
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="max-w-lg">
      <Link
        href="/matieres-premieres"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux matières premières
      </Link>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Modifier la matière première</h2>
        {mp && (
          <p className="text-xs text-slate-400 mb-5">
            Stock actuel : <strong className="text-slate-600">{mp.quantite} kg</strong>
            {' '}— géré automatiquement via les lots fournisseurs
          </p>
        )}

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              {...register('nom')}
              type="text"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
            {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Prix d&apos;achat ({getCurrencyLabel()}/kg) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                {...register('prix_kg')}
                type="number"
                step="0.01"
                min="0"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition pr-12"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                {getCurrencyLabel()}/kg
              </span>
            </div>
            {errors.prix_kg && <p className="text-red-500 text-xs mt-1">{errors.prix_kg.message}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              href="/matieres-premieres"
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
              {mutation.isPending ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
