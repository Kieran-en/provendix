'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Users, Search, Eye, Phone, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import api from '@/lib/api'
import { Client, PaginatedResponse } from '@/types'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { toast } from 'sonner'
import { AxiosError } from 'axios'

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Client>>('/clients', {
        params: { page, limit: 20, search: search || undefined },
      })
      return res.data
    },
  })

  const items = data?.data ?? []
  const total = data?.total ?? 0
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/clients/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client supprimé') },
    onError: (error: AxiosError<{ error?: string }>) => toast.error(error.response?.data?.error ?? 'Ce client ne peut pas être supprimé'),
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
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
        <Link
          href="/clients/nouveau"
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouveau client</span>
        </Link>
      </div>

      <p className="text-sm text-slate-500">{total} client{total > 1 ? 's' : ''}</p>

      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun client"
          description="Créez votre première fiche client."
          action={
            <Link
              href="/clients/nouveau"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4" />
              Nouveau client
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
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 bg-slate-50">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 bg-slate-50">Animaux</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 bg-slate-50">Années élevage</th>
                  <th className="px-4 py-3 bg-slate-50" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-700 font-semibold text-xs">
                            {client.nom.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{client.nom}</p>
                          {client.adresse && (
                            <p className="text-xs text-slate-400 truncate max-w-[180px]">{client.adresse}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {client.contact ? (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {client.contact}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {client.animaux_eleves || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-600">
                      {client.annees_elevage > 0 ? `${client.annees_elevage} ans` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2"><Link href={`/clients/${client.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-emerald-600"><Eye className="h-3.5 w-3.5" /> Voir / modifier</Link><button type="button" onClick={() => confirm(`Supprimer « ${client.nom} » ?`) && deleteMutation.mutate(client.id)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button></div>
                    </td>
                  </tr>
                ))}
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
