'use client'

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import api from '@/lib/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  ScrollText, Plus, Pencil, Trash2, Eye, Filter,
  ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogEntry {
  id: number
  action: string
  action_label: string
  module: string
  objet: string
  objet_id: number | null
  description: string
  changements: Record<string, [string, string]>
  utilisateur_nom: string | null
  utilisateur_role: string | null
  created_at: string
}

interface LogsResponse {
  data: LogEntry[]
  total: number
  page: number
  limit: number
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  access: Eye,
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  update: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  delete: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  access: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

const ACTIONS = [
  { value: '', label: 'Toutes les actions' },
  { value: 'create', label: 'Création' },
  { value: 'update', label: 'Modification' },
  { value: 'delete', label: 'Suppression' },
]

// Valeurs attendues par le filtre `module` de l'API /logs
const MODULES = [
  { value: '', label: 'Tous les modules' },
  { value: 'utilisateurs', label: 'Utilisateurs' },
  { value: 'clients', label: 'Clients' },
  { value: 'mp', label: 'Matières premières' },
  { value: 'formules', label: 'Formules' },
  { value: 'lots fournisseurs', label: 'Lots fournisseurs' },
  { value: 'lots produits finis', label: 'Lots produits finis' },
  { value: 'production', label: 'Production' },
  { value: 'ventes', label: 'Ventes' },
  { value: 'inventaire', label: 'Inventaire' },
  { value: 'parametres', label: 'Paramètres' },
]

const inputClass =
  'text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500'

export default function LogsPage() {
  const [action, setAction] = useState('')
  const [module, setModule] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const params = new URLSearchParams()
  if (action) params.set('action', action)
  if (module) params.set('module', module)
  if (dateFrom) params.set('from', dateFrom)
  if (dateTo) params.set('to', dateTo)
  params.set('page', String(page))

  const { data, isLoading } = useQuery<LogsResponse>({
    queryKey: ['logs', action, module, dateFrom, dateTo, page],
    queryFn: async () => {
      const res = await api.get<LogsResponse>(`/logs?${params}`)
      return res.data
    },
    placeholderData: keepPreviousData,
  })

  const logs = data?.data ?? []
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  const updateFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-emerald-600" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Journal d&apos;audit
        </h2>
        {data?.total != null && (
          <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
            {data.total} entrée{data.total > 1 ? 's' : ''} au total
          </span>
        )}
      </div>

      {/* Filtres */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filtres</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select
            value={action}
            onChange={(e) => updateFilter(setAction)(e.target.value)}
            className={inputClass}
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
          <select
            value={module}
            onChange={(e) => updateFilter(setModule)(e.target.value)}
            className={inputClass}
          >
            {MODULES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => updateFilter(setDateFrom)(e.target.value)}
            className={inputClass}
            aria-label="Date de début"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => updateFilter(setDateTo)(e.target.value)}
            className={inputClass}
            aria-label="Date de fin"
          />
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <LoadingSpinner />
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
          <ScrollText className="w-10 h-10 opacity-30" />
          <span className="text-sm font-medium">Aucune entrée d&apos;audit</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Les créations, modifications et suppressions apparaîtront ici automatiquement.
          </span>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {logs.map((log) => {
              const Icon = ACTION_ICONS[log.action] ?? ScrollText
              const color = ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-600'
              const changes = Object.entries(log.changements ?? {})
              const isExpanded = expandedId === log.id
              return (
                <div key={log.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    disabled={changes.length === 0}
                    className={cn(
                      'w-full text-left flex items-start gap-4 px-5 py-3.5 transition-colors',
                      changes.length > 0 && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30',
                    )}
                  >
                    <div className={cn('mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {log.utilisateur_nom ?? 'Système'}
                        </span>
                        {log.utilisateur_role && (
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded capitalize">
                            {log.utilisateur_role}
                          </span>
                        )}
                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                          {log.module}
                        </span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', color)}>
                          {log.action_label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                        {log.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      {changes.length > 0 && (
                        <ChevronDown
                          className={cn(
                            'w-3.5 h-3.5 text-slate-400 transition-transform',
                            isExpanded && 'rotate-180',
                          )}
                        />
                      )}
                    </div>
                  </button>

                  {/* Détail des champs modifiés (avant → après) */}
                  {isExpanded && changes.length > 0 && (
                    <div className="px-5 pb-4 pl-16">
                      <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400">
                              <th className="text-left font-medium px-3 py-1.5">Champ</th>
                              <th className="text-left font-medium px-3 py-1.5">Avant</th>
                              <th className="text-left font-medium px-3 py-1.5">Après</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {changes.map(([field, [before, after]]) => (
                              <tr key={field}>
                                <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200">{field}</td>
                                <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400 break-all">{before || '—'}</td>
                                <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200 break-all">{after || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page {data?.page ?? page} sur {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Page précédente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Page suivante"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
