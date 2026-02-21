'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer, User, Package, CreditCard } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { Commande } from '@/types'
import { formatCurrency, formatDateTime, formatWeight } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Badge from '@/components/ui/Badge'

export default function VenteDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: commande, isLoading } = useQuery({
    queryKey: ['commande', id],
    queryFn: async () => {
      const res = await api.get<Commande>(`/commandes/${id}`)
      return res.data
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (!commande) return null

  const pConfig = {
    cash: { label: 'Cash', variant: 'success' as const },
    credit: { label: 'Crédit', variant: 'danger' as const },
    partiel: { label: 'Partiellement payé', variant: 'warning' as const },
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
      </div>

      {/* Facture printable */}
      <div id="facture" className="bg-white border border-slate-200 rounded-xl overflow-hidden print:border-0 print:shadow-none">
        {/* En-tête */}
        <div className="bg-emerald-600 px-6 py-5 print:bg-white print:border-b print:border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-white font-bold text-xl print:text-slate-900">PROVENDIX</h1>
              <p className="text-emerald-100 text-sm mt-0.5 print:text-slate-500">Facture de vente</p>
            </div>
            <div className="text-right">
              <p className="text-white font-mono text-sm print:text-slate-900">N° {String(commande.id).padStart(6, '0')}</p>
              <p className="text-emerald-200 text-xs mt-1 print:text-slate-400">{formatDateTime(commande.date_heure)}</p>
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
              <p className="font-semibold text-slate-800">{commande.client?.nom ?? `Client #${commande.client_id}`}</p>
              {commande.client?.contact && <p className="text-sm text-slate-500 mt-0.5">{commande.client.contact}</p>}
              {commande.client?.adresse && <p className="text-sm text-slate-400">{commande.client.adresse}</p>}
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
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Prix/kg</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commande.lignes?.map((ligne) => {
                  const prixUnit = commande.montant / (commande.lignes?.reduce((a, l) => a + l.quantite, 0) || 1)
                  return (
                    <tr key={ligne.id}>
                      <td className="px-4 py-3">
                        {ligne.formule?.nom ?? ligne.lot_pf?.formule?.nom ?? `Lot PF #${ligne.lot_pf_id}`}
                      </td>
                      <td className="px-4 py-3 text-right">{formatWeight(ligne.quantite)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(prixUnit)}/kg</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(prixUnit * ligne.quantite)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="flex justify-end">
            <div className="bg-slate-50 rounded-lg px-5 py-4 min-w-[200px]">
              <div className="flex items-center justify-between gap-8">
                <span className="text-sm text-slate-600">Total TTC</span>
                <span className="text-xl font-bold text-slate-900">{formatCurrency(commande.montant)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
