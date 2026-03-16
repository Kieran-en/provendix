'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  ScrollText, LogIn, LogOut, Plus, Pencil, Trash2,
  Factory, ShoppingCart, BarChart2, KeyRound, Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogEntry {
  id: number
  utilisateur: number | null
  utilisateur_nom: string | null
  utilisateur_role: string | null
  action: string
  action_label: string
  module: string
  objet_id: number | null
  description: string
  ip_address: string | null
  created_at: string
}

interface LogsResponse {
  data: LogEntry[]
  total: number
  page: number
  limit: number
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  login: LogIn,
  logout: LogOut,
  create: Plus,
  update: Pencil,
  delete: Trash2,
  production: Factory,
  vente: ShoppingCart,
  ajustement: BarChart2,
  reset_password: KeyRound,
}

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  logout: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  create: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  update: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  delete: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  production: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  vente: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  ajustement: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  reset_password: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
}

const ACTIONS = [
  { value: '', label: 'Toutes les actions' },
  { value: 'login', label: 'Connexion' },
  { value: 'logout', label: 'Déconnexion' },
  { value: 'create', label: 'Création' },
  { value: 'update', label: 'Modification' },
  { value: 'delete', label: 'Suppression' },
  { value: 'production', label: 'Production' },
  { value: 'vente', label: 'Vente' },
  { value: 'ajustement', label: 'Ajustement stock' },
]

export default function LogsPage() {
  const [action, setAction] = useState('')
  const [module, setModule] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const params = new URLSearchParams()
  if (action) params.set('action', action)
  if (module) params.set('module', module)
  if (dateFrom) params.set('from', dateFrom)
  if (dateTo) params.set('to', dateTo)

  const { data, isLoading } = useQuery<LogsResponse>({
    queryKey: ['logs', action, module, dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get<LogsResponse>(`/logs?${params}`)
      return res.data
    },
  })

  const logs = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-emerald-600" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Journal d'activité
        </h2>
        {data?.total != null && (
          <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
            {data.total} entrées au total
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
            onChange={(e) => setAction(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Module (ex: MP, Ventes…)"
            value={module}
            onChange={(e) => setModule(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <LoadingSpinner />
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-slate-400 gap-2">
          <ScrollText className="w-10 h-10 opacity-30" />
          <span className="text-sm">Aucun log trouvé</span>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {logs.map((log) => {
              const Icon = ACTION_ICONS[log.action] ?? ScrollText
              const color = ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-600'
              return (
                <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className={cn('mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {log.utilisateur_nom ?? 'Système'}
                      </span>
                      {log.utilisateur_role && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
                          {log.utilisateur_role}
                        </span>
                      )}
                      <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                        {log.module}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{log.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                    {log.ip_address && (
                      <p className="text-[10px] text-slate-300 dark:text-slate-600">{log.ip_address}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
