'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FlaskConical, Search, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import api from '@/lib/api'
import { Formule, PaginatedResponse } from '@/types'
import { formatWeight } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { toast } from 'sonner'
import { AxiosError } from 'axios'

export default function FormulesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['formules', page, search],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Formule>>('/formules', {
        params: { page, limit: 20, search: search || undefined },
      })
      return res.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/formules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formules'] })
      toast.success('Formule supprimée')
    },
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur lors de la suppression')
    },
  })

  const handleDelete = (id: number, nom: string) => {
    if (confirm(`Supprimer la formule "${nom}" ?`)) {
      deleteMutation.mutate(id)
    }
  }

  const items = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une formule..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <Link
          href="/formules/nouvelle"
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle formule</span>
        </Link>
      </div>

      <p className="text-sm text-slate-500">{total} formule{total > 1 ? 's' : ''}</p>

      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Aucune formule"
          description="Créez votre première formule standard."
          action={
            <Link
              href="/formules/nouvelle"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4" />
              Nouvelle formule
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((formule) => (
            <div key={formule.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Header de la formule */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FlaskConical className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{formule.nom}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{formule.code}</p>
                </div>
                {/* Nb ingrédients */}
                {formule.compositions && (
                  <span className="text-xs text-slate-400 hidden sm:block">
                    {formule.compositions.length} ingrédient{formule.compositions.length > 1 ? 's' : ''}
                  </span>
                )}
                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Link
                    href={`/formules/${formule.id}`}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition"
                    title="Modifier"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(formule.id, formule.nom)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {formule.compositions && formule.compositions.length > 0 && (
                    <button
                      onClick={() => setExpanded(expanded === formule.id ? null : formule.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md transition"
                    >
                      {expanded === formule.id
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Compositions dépliables */}
              {expanded === formule.id && formule.compositions && (
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                    Composition
                  </p>
                  <div className="space-y-1.5">
                    {formule.compositions.map((comp) => (
                      <div key={comp.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">
                          {(comp as any).mp_nom ?? comp.matiere_premiere?.nom ?? `MP #${comp.matiere_premiere_id}`}
                        </span>
                        <span className="font-medium text-slate-800">{formatWeight(comp.quantite)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between">
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
  )
}
