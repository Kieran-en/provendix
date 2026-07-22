'use client'

import { useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Printer, User, Package, CreditCard, Loader2, Ban } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Commande } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Badge from '@/components/ui/Badge'
import { useAuthStore } from '@/store/auth.store'

interface Facture extends Commande {
  produit?: string
  configuration?: {
    nom_provenderie: string
    adresse: string
    telephone: string
    nif: string
    devise: 'XAF' | 'XOF'
  }
}

export default function VenteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [montantPaiement, setMontantPaiement] = useState('')
  const user = useAuthStore((state) => state.user)

  const { data: commande, isLoading } = useQuery({
    queryKey: ['commande', id],
    queryFn: async () => {
      const res = await api.get<Facture>(`/commandes/${id}/facture`)
      return res.data
    },
  })

  const paiementMutation = useMutation({
    mutationFn: (montant: number) => api.patch(`/commandes/${id}/paiement`, { montant }),
    onSuccess: () => {
      setMontantPaiement('')
      queryClient.invalidateQueries({ queryKey: ['commande', id] })
      queryClient.invalidateQueries({ queryKey: ['commandes'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Paiement enregistré')
    },
    onError: () => toast.error('Impossible d’enregistrer ce paiement'),
  })

  const annulationMutation = useMutation({
    mutationFn: () => api.post(`/commandes/${id}/annuler`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commande', id] })
      queryClient.invalidateQueries({ queryKey: ['commandes'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Vente annulée et stock restauré')
    },
    onError: () => toast.error('Cette vente ne peut pas être annulée'),
  })

  if (isLoading) return <LoadingSpinner />
  if (!commande) return null

  const pConfig = {
    non_paye: { label: 'Non payé', variant: 'danger' as const },
    partiel: { label: 'Partiellement payé', variant: 'warning' as const },
    paye: { label: 'Payé', variant: 'success' as const },
  }[commande.statut_paiement]

  const handlePrint = () => window.print()

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/ventes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Retour aux ventes
        </Link>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-3.5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
        >
          <Printer className="w-4 h-4" />
          Imprimer la facture
        </button>
        {(user?.role === 'superviseur' || user?.role === 'admin') && commande.statut !== 'annulee' && commande.montant_paye === 0 && (
          <button type="button" onClick={() => confirm('Annuler cette vente et restaurer le stock ?') && annulationMutation.mutate()} disabled={annulationMutation.isPending} className="flex items-center gap-2 rounded-lg border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"><Ban className="h-4 w-4" /> Annuler la vente</button>
        )}
      </div>

      {/* Facture printable */}
      <div id="facture" className="bg-white border border-slate-200 rounded-xl overflow-hidden print:border-0 print:shadow-none">
        {/* En-tête */}
        <div className="bg-emerald-600 px-6 py-5 print:bg-white print:border-b print:border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-white font-bold text-xl print:text-slate-900">{commande.configuration?.nom_provenderie ?? 'PROVENDIX'}</h1>
              <p className="text-emerald-100 text-sm mt-0.5 print:text-slate-500">Facture de vente</p>
            </div>
            <div className="text-right">
              <p className="text-white font-mono text-sm print:text-slate-900">N° {commande.numero_commande ?? String(commande.id).padStart(6, '0')}</p>
              <p className="text-emerald-200 text-xs mt-1 print:text-slate-400">{formatDate(commande.date_commande)}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Infos client + paiement */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</span>
              </div>
              <p className="font-semibold text-slate-800">{commande.client_nom ?? `Client #${commande.client}`}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Paiement</span>
              </div>
              <Badge label={pConfig.label} variant={pConfig.variant} />
            </div>
          </div>

          {/* Lignes de commande */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Articles</span>
            </div>
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Produit</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Quantité</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Prix/{commande.unite}</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3">{commande.produit ?? commande.produit_nom}</td>
                  <td className="px-4 py-3 text-right">{Number(commande.quantite).toLocaleString('fr-FR')} {commande.unite}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(commande.prix_unitaire)}/{commande.unite}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(commande.montant_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="flex justify-end">
            <div className="bg-slate-50 rounded-lg px-5 py-4 min-w-[200px]">
              <div className="flex items-center justify-between gap-8">
                <span className="text-sm text-slate-600">Total TTC</span>
                <span className="text-xl font-bold text-slate-900">{formatCurrency(commande.montant_total ?? commande.montant)}</span>
              </div>
              <div className="flex items-center justify-between gap-8 mt-2 text-sm">
                <span className="text-slate-500">Reste à payer</span>
                <span className="font-semibold text-slate-800">{formatCurrency(commande.reste_a_payer)}</span>
              </div>
            </div>
          </div>

          {commande.reste_a_payer > 0 && commande.statut !== 'annulee' && (
            <div className="border-t border-slate-200 pt-5 print:hidden">
              <h2 className="text-sm font-semibold text-slate-800 mb-2">Enregistrer un versement</h2>
              <div className="flex gap-2">
                <input
                  value={montantPaiement}
                  onChange={(event) => setMontantPaiement(event.target.value)}
                  type="number"
                  min="1"
                  max={commande.reste_a_payer}
                  step="1"
                  placeholder="Montant"
                  className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  disabled={paiementMutation.isPending || !(parseFloat(montantPaiement) > 0)}
                  onClick={() => paiementMutation.mutate(parseFloat(montantPaiement))}
                  className="px-4 py-2 bg-emerald-600 disabled:bg-emerald-400 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  {paiementMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Encaisser
                </button>
              </div>
            </div>
          )}

          {!!commande.paiements?.length && (
            <div className="border-t border-slate-200 pt-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-2">Historique des paiements</h2>
              <div className="space-y-1.5">
                {commande.paiements.map((paiement) => (
                  <div key={paiement.id} className="flex justify-between text-sm">
                    <span className="text-slate-500">{formatDate(paiement.created_at)}</span>
                    <span className="font-medium text-slate-800">{formatCurrency(paiement.montant)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
