'use client'

import { useQuery } from '@tanstack/react-query'
import { Plus, Truck, Search, Package } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import api from '@/lib/api'
import { LotFournisseur, PaginatedResponse } from '@/types'
import { formatCurrency, formatDate, formatWeight } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'

export default function LotsFournisseursPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['lots-fournisseurs', page, search],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<LotFournisseur>>('/lots-fournisseurs', {
        params: { page, limit: 20, search: search || undefined },
      })
      return res.data
    },
  })

  const items = data?.data ?? []
  const total = data?.total ?? 0

  const getStockBadge = (lot: LotFournisseur) => {
    const ratio = lot.quantite_restante / lot.quantite_initiale
    if (ratio <= 0) return <Badge label="Épuisé" variant="danger" />
    if (ratio < 0.2) return <Badge label="Critique" variant="warning" />
    return <Badge label="Disponible" variant="success" />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par MP..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <Link
          href="/lots-fournisseurs/nouveau"
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Réception MP</span>
        </Link>
      </div>

      <p className="text-sm text-slate-500">{total} lot{total > 1 ? 's' : ''} enregistré{total > 1 ? 's' : ''}</p>

      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Aucun lot reçu"
          description="Enregistrez la première réception de matière première."
          action={
            <Link
              href="/lots-fournisseurs/nouveau"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4" />
              Réception MP
            </Link>
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 bg-slate-50">Matière première</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 bg-slate-50">Qté initiale</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 bg-slate-50">Qté restante</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 bg-slate-50">Coût/kg</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 bg-slate-50">Date réception</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 bg-slate-50">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((lot) => (
                  <tr key={lot.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="font-medium text-slate-800">
                          {lot.matiere_premiere?.nom ?? `MP #${lot.matiere_premiere_id}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-600">{formatWeight(lot.quantite_initiale)}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-slate-800">
                      {formatWeight(lot.quantite_restante)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-600">{formatCurrency(lot.cout_kg)}/kg</td>
                    <td className="px-4 py-3.5 text-slate-600">{formatDate(lot.date_reception)}</td>
                    <td className="px-4 py-3.5 text-center">{getStockBadge(lot)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">Page {page} / {Math.ceil(total / 20)}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50 transition"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(total / 20)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50 transition"
                >
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
