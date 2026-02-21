'use client'

import { useQuery } from '@tanstack/react-query'
import { Plus, ShoppingCart, Search, Eye, Calendar } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import api from '@/lib/api'
import { Commande, PaginatedResponse } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'

export default function VentesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dateFilter, setDateFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['commandes', page, search, dateFilter],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Commande>>('/commandes', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          date: dateFilter || undefined,
        },
      })
      return res.data
    },
  })

  const items = data?.data ?? []
  const total = data?.total ?? 0

  const paiementConfig = {
    cash: { label: 'Cash', variant: 'success' as const },
    credit: { label: 'Crédit', variant: 'danger' as const },
    partiel: { label: 'Partiel', variant: 'warning' as const },
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setPage(1) }}
            className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <Link
          href="/ventes/nouvelle"
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle vente</span>
        </Link>
      </div>

      <p className="text-sm text-slate-500">{total} vente{total > 1 ? 's' : ''}</p>

      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Aucune vente"
          description="Enregistrez votre première vente."
          action={
            <Link
              href="/ventes/nouvelle"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4" />
              Nouvelle vente
            </Link>
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 bg-slate-50">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 bg-slate-50">Date & Heure</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 bg-slate-50">Montant</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 bg-slate-50">Paiement</th>
                  <th className="px-4 py-3 bg-slate-50" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((cmd) => {
                  const pConfig = paiementConfig[cmd.statut_paiement]
                  return (
                    <tr key={cmd.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-emerald-50 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-700 font-semibold text-xs">
                              {(cmd.client?.nom ?? 'C').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-slate-800">
                            {cmd.client?.nom ?? `Client #${cmd.client_id}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{formatDateTime(cmd.date_heure)}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-800">
                        {formatCurrency(cmd.montant)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge label={pConfig.label} variant={pConfig.variant} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/ventes/${cmd.id}`}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 transition-colors font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Détail
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">Page {page} / {Math.ceil(total / 20)}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50 transition">
                  Précédent
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50 transition">
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
