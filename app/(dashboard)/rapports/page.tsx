'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Download, TrendingUp, ShoppingCart, Wheat, Factory } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, formatWeight } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import StatCard from '@/components/ui/StatCard'

interface RapportData {
  total_ventes: number
  ca_total: number
  marge_totale: number
  productions_total: number
  mp_consommation: { nom: string; quantite: number }[]
  ventes_par_jour: { date: string; montant: number; nb_ventes: number }[]
  top_clients: { nom: string; montant: number; nb_commandes: number }[]
}

export default function RapportsPage() {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0]

  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(today)

  const { data, isLoading } = useQuery({
    queryKey: ['rapports', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get<RapportData>('/rapports/ventes', {
        params: { from: dateFrom, to: dateTo },
      })
      return res.data
    },
    enabled: !!dateFrom && !!dateTo,
  })

  const handleExport = async (format: 'pdf' | 'csv') => {
    try {
      const res = await api.get('/rapports/export', {
        params: { type: format, rapport: 'ventes', from: dateFrom, to: dateTo },
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport_ventes_${dateFrom}_${dateTo}.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      // handled silently — backend may not have this endpoint yet
    }
  }

  return (
    <div className="space-y-5">
      {/* Filtres date + export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 whitespace-nowrap">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 whitespace-nowrap">au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !data ? null : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Ventes" value={data.total_ventes} icon={ShoppingCart} color="emerald" />
            <StatCard label="CA total" value={formatCurrency(data.ca_total)} icon={TrendingUp} color="blue" />
            <StatCard label="Marge totale" value={formatCurrency(data.marge_totale)} icon={BarChart3} color="amber" />
            <StatCard label="Productions" value={data.productions_total} icon={Factory} color="rose" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Ventes par jour */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-700">Ventes par jour</h3>
              </div>
              {data.ventes_par_jour.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Aucune donnée</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {data.ventes_par_jour.map((v) => (
                    <div key={v.date} className="flex items-center justify-between px-5 py-3 text-sm">
                      <span className="text-slate-600">{formatDate(v.date)}</span>
                      <div className="text-right">
                        <p className="font-semibold text-slate-800">{formatCurrency(v.montant)}</p>
                        <p className="text-xs text-slate-400">{v.nb_ventes} vente{v.nb_ventes > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Consommation MP */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
                <Wheat className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-700">Consommation MP</h3>
              </div>
              {data.mp_consommation.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Aucune donnée</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {data.mp_consommation.map((mp) => (
                    <div key={mp.nom} className="flex items-center justify-between px-5 py-3 text-sm">
                      <span className="text-slate-700">{mp.nom}</span>
                      <span className="font-semibold text-slate-800">{formatWeight(mp.quantite)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top clients */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden lg:col-span-2">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-700">Top clients</h3>
              </div>
              {data.top_clients.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Aucune donnée</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-5 py-3 text-left font-semibold text-slate-600 bg-slate-50">Client</th>
                      <th className="px-5 py-3 text-right font-semibold text-slate-600 bg-slate-50">CA</th>
                      <th className="px-5 py-3 text-right font-semibold text-slate-600 bg-slate-50">Commandes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.top_clients.map((c, i) => (
                      <tr key={c.nom} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-800">
                          <span className="text-slate-400 text-xs mr-2">#{i + 1}</span>
                          {c.nom}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-700 font-semibold">
                          {formatCurrency(c.montant)}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-500">
                          {c.nb_commandes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
