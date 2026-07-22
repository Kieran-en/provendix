'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart2,
  Factory,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useThemeStore } from '@/store/theme.store'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import StatCard from '@/components/ui/StatCard'

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

type Insight = 'ca' | 'stock' | 'clients' | 'matieres'

const COLORS = ['#059669', '#2563eb', '#d99b2b', '#e11d48', '#7c3aed', '#0891b2']

const insightTabs: { value: Insight; label: string }[] = [
  { value: 'ca', label: "Chiffre d'affaires" },
  { value: 'stock', label: 'Mouvements' },
  { value: 'clients', label: 'Top clients' },
  { value: 'matieres', label: 'Consommation' },
]

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { theme } = useThemeStore()
  const [activeInsight, setActiveInsight] = useState<Insight>('ca')
  const isGerant = user?.role === 'gerant'

  const { data: stats, isLoading: loadingStats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await api.get<DashboardStats>('/dashboard/stats')).data,
  })

  const { data: rapport } = useQuery<RapportData>({
    queryKey: ['dashboard-rapport'],
    queryFn: async () => {
      const to = new Date().toISOString().split('T')[0]
      const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
      return (await api.get<RapportData>(`/rapports/ventes?from=${from}&to=${to}`)).data
    },
    enabled: !isGerant && !!user,
  })

  const today = formatDate(new Date().toISOString())
  const firstName = user?.nom?.trim().split(/\s+/)[0] || user?.login
  const ventesJour = rapport?.ventes_par_jour?.slice(-30) ?? []
  const topClients = rapport?.top_clients?.slice(0, 5) ?? []
  const mpConso = rapport?.mp_consommation?.slice(0, 6) ?? []
  const stockEvol = stats?.stock_evolution ?? []
  const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0'
  const tickColor = theme === 'dark' ? '#94a3b8' : '#64748b'

  const renderChart = (insight: Insight) => {
    if (insight === 'ca') {
      return ventesJour.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={245}>
          <AreaChart data={ventesJour} margin={{ top: 8, right: 8, left: 2, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.34} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 5" stroke={gridColor} vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} tickFormatter={(value) => value.slice(5)} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} width={48} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
            <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'CA']} labelFormatter={(label) => `Date : ${label}`} contentStyle={{ fontSize: 12, borderRadius: 12, borderColor: gridColor }} />
            <Area type="monotone" dataKey="montant" stroke="#059669" strokeWidth={2.5} fill="url(#gradCA)" />
          </AreaChart>
        </ResponsiveContainer>
      )
    }

    if (insight === 'stock') {
      return stockEvol.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={245}>
          <BarChart data={stockEvol} margin={{ top: 8, right: 8, left: 2, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 5" stroke={gridColor} vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} tickFormatter={(value) => value.slice(5)} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} width={42} />
            <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)} kg`, name === 'entrees' ? 'Entrées' : 'Sorties']} contentStyle={{ fontSize: 12, borderRadius: 12, borderColor: gridColor }} />
            <Legend formatter={(value) => value === 'entrees' ? 'Entrées' : 'Sorties'} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="entrees" fill="#059669" radius={[5, 5, 0, 0]} />
            <Bar dataKey="sorties" fill="#e11d48" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    }

    if (insight === 'clients') {
      return topClients.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={245}>
          <BarChart layout="vertical" data={topClients} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 5" stroke={gridColor} horizontal={false} />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
            <YAxis type="category" dataKey="nom" width={105} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} />
            <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'CA']} contentStyle={{ fontSize: 12, borderRadius: 12, borderColor: gridColor }} />
            <Bar dataKey="montant" radius={[0, 6, 6, 0]}>{topClients.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      )
    }

    return mpConso.length === 0 ? <EmptyChart /> : (
      <ResponsiveContainer width="100%" height={245}>
        <PieChart>
          <Pie data={mpConso} dataKey="quantite" nameKey="nom" cx="50%" cy="45%" innerRadius={48} outerRadius={78} paddingAngle={2}>
            {mpConso.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)} kg`, String(name)]} contentStyle={{ fontSize: 12, borderRadius: 12, borderColor: gridColor }} />
          <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 10, lineHeight: '20px' }} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-6 text-white shadow-xl shadow-slate-900/10 sm:px-7 sm:py-7">
        <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-emerald-400/10 blur-2xl" />
        <div className="absolute bottom-0 right-0 h-24 w-48 bg-[radial-gradient(circle_at_bottom_right,rgba(217,155,43,0.22),transparent_70%)]" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">{today}</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Bonjour, {firstName}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              {isGerant ? 'Vos opérations du jour sont réunies ici.' : "Suivez l'activité, anticipez les besoins et gardez le contrôle sur les stocks."}
            </p>
          </div>
          <Link href={isGerant ? '/ventes/nouvelle' : '/rapports'} className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50">
            {isGerant ? 'Enregistrer une vente' : 'Consulter les rapports'}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {loadingStats ? <LoadingSpinner /> : (
        <section aria-label="Indicateurs du jour" className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
          <StatCard label="Ventes aujourd'hui" value={stats?.ventes_jour ?? 0} icon={ShoppingCart} trend="commandes enregistrées" color="emerald" />
          <StatCard label="CA du jour" value={formatCurrency(stats?.ca_jour ?? 0)} icon={TrendingUp} color="blue" />
          <StatCard label="Productions du jour" value={stats?.productions_jour ?? 0} icon={Factory} color="amber" />
          {isGerant
            ? <StatCard label="Clients" value={stats?.clients_total ?? 0} icon={Users} color="rose" />
            : <StatCard label="Alertes stock" value={stats?.alertes_stock ?? 0} icon={AlertTriangle} trend="articles sous le seuil" color="rose" />}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">Accès direct</p><h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">Actions rapides</h3></div>
        </div>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {isGerant ? (
            <>
              <QuickAction href="/ventes/nouvelle" icon={ShoppingCart} label="Nouvelle vente" description="Vendre un produit" />
              <QuickAction href="/production/nouvelle" icon={Factory} label="Produire" description="Lancer une production" />
              <QuickAction href="/clients/nouveau" icon={Users} label="Nouveau client" description="Créer une fiche" />
            </>
          ) : (
            <>
              <QuickAction href="/lots-fournisseurs/nouveau" icon={Package} label="Réception MP" description="Ajouter un arrivage" />
              <QuickAction href="/formules/nouvelle" icon={Factory} label="Nouvelle formule" description="Composer un aliment" />
              <QuickAction href="/inventaire" icon={Package} label="Inventaire" description="Ajuster les stocks" />
            </>
          )}
        </div>
      </section>

      {!isGerant && (
        <section>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">Pilotage</p>
            <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">Tendances de l’activité</h3>
          </div>

          <div className="xl:hidden">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Indicateurs graphiques">
              {insightTabs.map((tab) => (
                <button key={tab.value} type="button" role="tab" aria-selected={activeInsight === tab.value} onClick={() => setActiveInsight(tab.value)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition ${activeInsight === tab.value ? 'bg-slate-900 text-white dark:bg-emerald-600' : 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <ChartCard title={insightTabs.find((tab) => tab.value === activeInsight)?.label ?? ''} icon={activeInsight === 'clients' ? Users : activeInsight === 'stock' ? BarChart2 : activeInsight === 'matieres' ? Package : TrendingUp}>
              {renderChart(activeInsight)}
            </ChartCard>
          </div>

          <div className="hidden grid-cols-2 gap-5 xl:grid">
            <ChartCard title="Chiffre d'affaires — 30 derniers jours" icon={TrendingUp}>{renderChart('ca')}</ChartCard>
            <ChartCard title="Mouvements de stock — 7 derniers jours" icon={BarChart2}>{renderChart('stock')}</ChartCard>
            <ChartCard title="Top 5 clients — CA cumulé" icon={Users}>{renderChart('clients')}</ChartCard>
            <ChartCard title="Consommation MP — répartition" icon={Package}>{renderChart('matieres')}</ChartCard>
          </div>
        </section>
      )}
    </div>
  )
}

function QuickAction({ href, icon: Icon, label, description }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; description: string }) {
  return (
    <Link href={href} className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-900/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800 sm:flex-row sm:gap-3 sm:p-4 sm:text-left">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-500/10 dark:text-emerald-400"><Icon className="h-[18px] w-[18px]" /></div>
      <div className="min-w-0"><span className="block text-xs font-bold leading-4 text-slate-800 dark:text-slate-100 sm:text-sm">{label}</span><span className="mt-0.5 hidden truncate text-xs text-slate-400 sm:block">{description}</span></div>
      <ArrowUpRight className="ml-auto hidden h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-emerald-600 sm:block" />
    </Link>
  )
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-4 flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"><Icon className="h-4 w-4" /></span><h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h4></div>
      {children}
    </div>
  )
}

function EmptyChart() {
  return <div className="flex h-[245px] flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-600"><BarChart2 className="h-9 w-9" /><span className="text-xs font-medium">Aucune donnée disponible</span></div>
}
