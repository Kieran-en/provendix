'use client'

import { useAuthStore } from '@/store/auth.store'
import StatCard from '@/components/ui/StatCard'
import { ShoppingCart, Package, Factory, Users, TrendingUp, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface DashboardStats {
  ventes_jour: number
  ca_jour: number
  productions_jour: number
  clients_total: number
  alertes_stock: number
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const isGerant = user?.role === 'gerant'

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get<DashboardStats>('/dashboard/stats')
      return res.data
    },
  })

  const today = formatDate(new Date().toISOString())

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Bonjour, {user?.nom} 👋
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">{today}</p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {isGerant ? (
            <>
              <StatCard
                label="Ventes aujourd'hui"
                value={stats?.ventes_jour ?? 0}
                icon={ShoppingCart}
                trend="commandes enregistrées"
                color="emerald"
              />
              <StatCard
                label="CA du jour"
                value={formatCurrency(stats?.ca_jour ?? 0)}
                icon={TrendingUp}
                color="blue"
              />
              <StatCard
                label="Productions du jour"
                value={stats?.productions_jour ?? 0}
                icon={Factory}
                color="amber"
              />
              <StatCard
                label="Clients"
                value={stats?.clients_total ?? 0}
                icon={Users}
                color="rose"
              />
            </>
          ) : (
            <>
              <StatCard
                label="Ventes aujourd'hui"
                value={stats?.ventes_jour ?? 0}
                icon={ShoppingCart}
                color="emerald"
              />
              <StatCard
                label="CA du jour"
                value={formatCurrency(stats?.ca_jour ?? 0)}
                icon={TrendingUp}
                color="blue"
              />
              <StatCard
                label="Productions"
                value={stats?.productions_jour ?? 0}
                icon={Factory}
                color="amber"
              />
              <StatCard
                label="Alertes stock"
                value={stats?.alertes_stock ?? 0}
                icon={AlertTriangle}
                trend="matières sous le seuil"
                color="rose"
              />
            </>
          )}
        </div>
      )}

      {/* Raccourcis rapides */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Actions rapides</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {isGerant ? (
            <>
              <QuickAction href="/ventes/nouvelle" icon={ShoppingCart} label="Nouvelle vente" />
              <QuickAction href="/production/nouvelle" icon={Factory} label="Nouvelle production" />
              <QuickAction href="/clients/nouveau" icon={Users} label="Nouveau client" />
            </>
          ) : (
            <>
              <QuickAction href="/lots-fournisseurs/nouveau" icon={Package} label="Réception MP" />
              <QuickAction href="/formules/nouvelle" icon={Factory} label="Nouvelle formule" />
              <QuickAction href="/inventaire" icon={Package} label="Inventaire" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-colors group"
    >
      <div className="w-8 h-8 bg-slate-100 group-hover:bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
        <Icon className="w-4 h-4 text-slate-500 group-hover:text-emerald-600 transition-colors" />
      </div>
      <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700 transition-colors">
        {label}
      </span>
    </a>
  )
}
