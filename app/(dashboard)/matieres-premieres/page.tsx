'use client'

import { useQuery } from '@tanstack/react-query'
import { Plus, Wheat, Search, Edit2, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import api from '@/lib/api'
import { MatierePremiere, PaginatedResponse } from '@/types'
import { formatCurrency, formatWeight } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'

export default function MatieresPremieres() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['matieres-premieres', page, search],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<MatierePremiere>>('/matieres-premieres', {
        params: { page, limit: 20, search: search || undefined },
      })
      return res.data
    },
  })

  const items = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une MP..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <Link
          href="/matieres-premieres/nouvelle"
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle MP</span>
        </Link>
      </div>

      {/* Résumé */}
      <p className="text-sm text-slate-500">{total} matière{total > 1 ? 's' : ''} première{total > 1 ? 's' : ''}</p>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Wheat}
          title="Aucune matière première"
          description="Ajoutez votre première matière première pour commencer."
          action={
            <Link
              href="/matieres-premieres/nouvelle"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4" />
              Nouvelle MP
            </Link>
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 bg-slate-50">Nom</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 bg-slate-50">Stock actuel</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 bg-slate-50">Seuil d'alerte</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 bg-slate-50">Prix / kg</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 bg-slate-50">État</th>
                  <th className="px-4 py-3 bg-slate-50" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((mp) => {
                  // Chaque MP a son propre seuil d'alerte (aligné sur le backend)
                  const alerte = mp.quantite < mp.seuil_alerte
                  return (
                    <tr key={mp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Wheat className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <span className="font-medium text-slate-800">{mp.nom}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {alerte && <TrendingDown className="w-3.5 h-3.5 text-rose-500" />}
                          <span className={alerte ? 'text-rose-600 font-semibold' : 'text-slate-700'}>
                            {formatWeight(mp.quantite)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-500">
                        {formatWeight(mp.seuil_alerte)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-700">
                        {formatCurrency(mp.prix_kg)}/kg
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge
                          label={alerte ? 'Stock bas' : 'Normal'}
                          variant={alerte ? 'danger' : 'success'}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/matieres-premieres/${mp.id}`}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 transition-colors font-medium"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Modifier
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Page {page} sur {Math.ceil(total / 20)}
              </p>
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
