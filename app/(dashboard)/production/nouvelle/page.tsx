'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Info, Wheat } from 'lucide-react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Formule, PaginatedResponse } from '@/types'
import { AxiosError } from 'axios'
import { formatWeight, formatCurrency } from '@/lib/utils'

const schema = z.object({
  formule_id: z.string().min(1, 'Sélectionnez une formule'),
  quantite_produite: z
    .string()
    .min(1, 'Quantité requise')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Quantité invalide'),
})

type FormData = z.infer<typeof schema>

export default function NouvelleProductionPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: formules } = useQuery({
    queryKey: ['formules-all'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Formule>>('/formules', {
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

  const formuleId = useWatch({ control, name: 'formule_id' })
  const quantite = useWatch({ control, name: 'quantite_produite' })

  const formuleSelectionnee = formules?.find((f) => f.id === parseInt(formuleId))
  const qte = parseFloat(quantite) || 0

  // Calcul des consommations MP estimées
  const consommations = formuleSelectionnee?.compositions?.map((comp) => ({
    nom: comp.matiere_premiere?.nom ?? `MP #${comp.matiere_premiere_id}`,
    quantite: comp.quantite * qte,
  }))

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post('/productions', {
        formule_id: parseInt(data.formule_id),
        quantite_produite: parseFloat(data.quantite_produite),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] })
      queryClient.invalidateQueries({ queryKey: ['matieres-premieres'] })
      queryClient.invalidateQueries({ queryKey: ['lots-fournisseurs'] })
      toast.success('Production enregistrée — lot PF généré')
      router.push('/production')
    },
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'enregistrement')
    },
  })

  return (
    <div className="max-w-lg">
      <Link
        href="/production"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux productions
      </Link>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Nouvelle production</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Le stock MP sera décrémenté et un lot de produit fini sera généré automatiquement.
          </p>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Formule <span className="text-red-500">*</span>
            </label>
            <select
              {...register('formule_id')}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            >
              <option value="">Sélectionner une formule...</option>
              {formules?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom} ({f.code})
                </option>
              ))}
            </select>
            {errors.formule_id && (
              <p className="text-red-500 text-xs mt-1">{errors.formule_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Quantité produite (kg) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                {...register('quantite_produite')}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition pr-10"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">kg</span>
            </div>
            {errors.quantite_produite && (
              <p className="text-red-500 text-xs mt-1">{errors.quantite_produite.message}</p>
            )}
          </div>

          {/* Aperçu des consommations */}
          {consommations && consommations.length > 0 && qte > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-amber-800">Consommations MP estimées</p>
              </div>
              <div className="space-y-1">
                {consommations.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <Wheat className="w-3 h-3" />
                      {c.nom}
                    </span>
                    <span className="font-semibold text-amber-800">{formatWeight(c.quantite)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Link
              href="/production"
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
              {mutation.isPending ? 'Enregistrement...' : 'Lancer la production'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
