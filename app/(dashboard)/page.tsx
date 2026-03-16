'use client'

import { useAuthStore } from '@/store/auth.store'
import StatCard from '@/components/ui/StatCard'
import {
  ShoppingCart, Package, Factory, Users,
  TrendingUp, AlertTriangle, BarChart2,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface DashboardStats {
  ventes_jour: number
  ca_jour: number
  productions_jour: number
  clients_total: number
  alertes_stock: number
  stock_evolution: { date: string; entrees: number; sorties: number }[]
}

interface RapportData {
  ventes_par_jour: { date: string; montant: number; nb_ventes: number }[]
  top_clients: { nom: string; montant: number; nb_commandes: number }[]
  mp_consommation: { nom: string; quantite: number }[]
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function DashboardPage() {
  const { user } = useAuthStore()
  const isGerant = user?.role === 'gerant'

  const { data: stats, isLoading: loadingStats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get<DashboardStats>('/dashboard/stats')
      return res.data
    },
  })

  // Données rapport pour les graphiques (30 derniers jours)
  const { data: rapport } = useQuery<RapportData>({
    queryKey: ['dashboard-rapport'],
    queryFn: async () => {
      const to = new Date().toISOString().split('T')[0]
      const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
      const res = await api.get<RapportData>(`/rapports/ventes?from=${from}&to=${to}`)
      return res.data
    },
  })

  const today = formatDate(new Date().toISOString())
  const ventesJour = rapport?.ventes_par_jour?.slice(-30) ?? []
  const topClients = rapport?.top_clients?.slice(0, 5) ?? []
  const mpConso = rapport?.mp_consommation?.slice(0, 6) ?? []
  const stockEvol = stats?.stock_evolution ?? []

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Bonjour, {user?.nom}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{today}</p>
      </div>

      {/* Stat Cards */}
      {loadingStats ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
          {isGerant ? (
            <StatCard
              label="Clients"
              value={stats?.clients_total ?? 0}
              icon={Users}
              color="rose"
            />
          ) : (
            <StatCard
              label="Alertes stock"
              value={stats?.alertes_stock ?? 0}
              icon={AlertTriangle}
              trend="matières sous le seuil"
              color="rose"
            />
          )}
        </div>
      )}

      {/* Actions rapides */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Actions rapides
        </h3>
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

      {/* ── GRAPHIQUES ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* 1. Ventes par jour (AreaChart) */}
        <ChartCard title="Chiffre d'affaires — 30 derniers jours" icon={TrendingUp}>
          {ventesJour.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={ventesJour} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={50}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v) => [formatCurrency(Number(v)), 'CA']}
                  labelFormatter={(l) => `Date : ${l}`}
                  contentStyle={{ fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="montant"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gradCA)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 2. Mouvements stock MP (BarChart entrees/sorties) */}
        <ChartCard title="Mouvements stock MP — 7 derniers jours" icon={BarChart2}>
          {stockEvol.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stockEvol} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={45} />
                <Tooltip
                  formatter={(v, name) => [
                    `${Number(v).toFixed(1)} kg`,
                    name === 'entrees' ? 'Entrées' : 'Sorties',
                  ]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend formatter={(v) => v === 'entrees' ? 'Entrées' : 'Sorties'} />
                <Bar dataKey="entrees" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="sorties" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 3. Top 5 clients (BarChart horizontal) */}
        <ChartCard title="Top 5 clients — CA cumulé" icon={Users}>
          {topClients.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                layout="vertical"
                data={topClients}
                margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nom" width={80}
                  tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  formatter={(v) => [formatCurrency(Number(v)), 'CA']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="montant" radius={[0, 4, 4, 0]}>
                  {topClients.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 4. Consommation MP (PieChart) */}
        <ChartCard title="Consommation MP — répartition" icon={Package}>
          {mpConso.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={mpConso}
                  dataKey="quantite"
                  nameKey="nom"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {mpConso.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name) => [`${Number(v).toFixed(1)} kg`, String(name)]}
                  contentStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

// ── Sous-composants ──

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
      className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors group"
    >
      <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
        <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 transition-colors" />
      </div>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
        {label}
      </span>
    </a>
  )
}

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-[220px] flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 gap-2">
      <BarChart2 className="w-10 h-10" />
      <span className="text-xs">Aucune donnée disponible</span>
    </div>
  )
}
