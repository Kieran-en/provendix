'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Info, Printer } from 'lucide-react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Client, LotPF, PaginatedResponse, StatutPaiement } from '@/types'
import { AxiosError } from 'axios'
import { formatCurrency, formatWeight } from '@/lib/utils'
import { Suspense } from 'react'

const schema = z.object({
  client_id: z.string().min(1, 'Sélectionnez un client'),
  lot_pf_id: z.string().min(1, 'Sélectionnez un lot de produit fini'),
  quantite: z
    .string()
    .min(1, 'Quantité requise')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Invalide'),
  prix_unitaire: z
    .string()
    .min(1, 'Prix requis')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Invalide'),
  statut_paiement: z.enum(['cash', 'credit', 'partiel']),
})

type FormData = z.infer<typeof schema>

function NouvelleVenteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const defaultClientId = searchParams.get('client_id') ?? ''

  const { data: clients } = useQuery({
    queryKey: ['clients-all'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Client>>('/clients', { params: { limit: 200 } })
      return res.data.data
    },
  })

  const { data: lotsPF } = useQuery({
    queryKey: ['lots-pf-disponibles'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<LotPF>>('/lots-pf', {
        params: { limit: 100, disponible: true },
      })
      return res.data.data
    },
  })

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id: defaultClientId,
      statut_paiement: 'cash',
    },
  })

  const quantite = useWatch({ control, name: 'quantite' })
  const prixUnitaire = useWatch({ control, name: 'prix_unitaire' })
  const lotPfId = useWatch({ control, name: 'lot_pf_id' })

  const montantTotal =
    parseFloat(quantite) > 0 && parseFloat(prixUnitaire) > 0
      ? parseFloat(quantite) * parseFloat(prixUnitaire)
      : null

  const lotSelectionne = lotsPF?.find((l) => l.id === parseInt(lotPfId))
  const stockInsuffisant =
    lotSelectionne && parseFloat(quantite) > 0
      ? parseFloat(quantite) > lotSelectionne.quantite_restante
      : false

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post('/commandes', {
        client_id: parseInt(data.client_id),
        lot_pf_id: parseInt(data.lot_pf_id),
        quantite: parseFloat(data.quantite),
        prix_unitaire: parseFloat(data.prix_unitaire),
        statut_paiement: data.statut_paiement,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] })
      queryClient.invalidateQueries({ queryKey: ['lots-pf-disponibles'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Vente enregistrée')
      router.push(`/ventes/${res.data.id}`)
    },
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'enregistrement')
    },
  })

  return (
    <div className="max-w-lg">
      <Link href="/ventes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour aux ventes
      </Link>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Nouvelle vente</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Le stock du lot PF sera décrémenté automatiquement.
          </p>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Client <span className="text-red-500">*</span>
            </label>
            <select {...register('client_id')}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition">
              <option value="">Sélectionner un client...</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
            {errors.client_id && <p className="text-red-500 text-xs mt-1">{errors.client_id.message}</p>}
          </div>

          {/* Lot PF */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Lot produit fini <span className="text-red-500">*</span>
            </label>
            <select {...register('lot_pf_id')}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition">
              <option value="">Sélectionner un lot PF...</option>
              {lotsPF?.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {(lot as any).formule_nom ?? `Lot #${lot.id}`} — {formatWeight(lot.quantite_restante)} dispo
                </option>
              ))}
            </select>
            {errors.lot_pf_id && <p className="text-red-500 text-xs mt-1">{errors.lot_pf_id.message}</p>}

            {/* Info lot sélectionné */}
            {lotSelectionne && (
              <p className="text-xs text-slate-400 mt-1">
                Stock : <strong className="text-slate-600">{formatWeight(lotSelectionne.quantite_restante)}</strong>
                {' '}· Coût revient : <strong className="text-slate-600">{formatCurrency(lotSelectionne.cout_revient)}/kg</strong>
              </p>
            )}
          </div>

          {/* Quantité + Prix */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Quantité (kg) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input {...register('quantite')} type="number" step="0.01" min="0" placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">kg</span>
              </div>
              {errors.quantite && <p className="text-red-500 text-xs mt-1">{errors.quantite.message}</p>}
              {stockInsuffisant && (
                <p className="text-rose-500 text-xs mt-1">Stock insuffisant</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Prix de vente (DA/kg) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input {...register('prix_unitaire')} type="number" step="0.01" min="0" placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition pr-14" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">DA/kg</span>
              </div>
              {errors.prix_unitaire && <p className="text-red-500 text-xs mt-1">{errors.prix_unitaire.message}</p>}
            </div>
          </div>

          {/* Mode de paiement */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Mode de paiement <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'credit', 'partiel'] as StatutPaiement[]).map((mode) => (
                <label key={mode} className="relative cursor-pointer">
                  <input {...register('statut_paiement')} type="radio" value={mode} className="sr-only peer" />
                  <div className="px-3 py-2.5 border border-slate-300 rounded-lg text-center text-sm font-medium text-slate-600 peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700 transition">
                    {mode === 'cash' ? 'Cash' : mode === 'credit' ? 'Crédit' : 'Partiel'}
                  </div>
                </label>
              ))}
            </div>
            {errors.statut_paiement && <p className="text-red-500 text-xs mt-1">{errors.statut_paiement.message}</p>}
          </div>

          {/* Récap montant */}
          {montantTotal !== null && !stockInsuffisant && (
            <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-3">
              <Info className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  Montant total : {formatCurrency(montantTotal)}
                </p>
                {lotSelectionne && (
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Marge estimée : {formatCurrency(montantTotal - parseFloat(quantite) * lotSelectionne.cout_revient)}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Link href="/ventes"
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition text-center">
              Annuler
            </Link>
            <button type="submit" disabled={mutation.isPending || !!stockInsuffisant}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer la vente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function NouvelleVentePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Chargement...</div>}>
      <NouvelleVenteForm />
    </Suspense>
  )
}
