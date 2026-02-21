'use client'

import { useQuery } from '@tanstack/react-query'
import { Package, Wheat, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { StockMP, StockPF } from '@/types'
import { formatWeight, formatCurrency } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Badge from '@/components/ui/Badge'

interface StocksData {
  matieres_premieres: StockMP[]
  produits_finis: StockPF[]
}

const SEUIL_ALERTE = 500

export default function StocksPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['stocks'],
    queryFn: async () => {
      const res = await api.get<StocksData>('/stocks')
      return res.data
    },
  })

  if (isLoading) return <LoadingSpinner />

  const mp = data?.matieres_premieres ?? []
  const pf = data?.produits_finis ?? []
  const alertes = mp.filter((s) => s.quantite_totale < SEUIL_ALERTE)

  return (
    <div className="space-y-6">
      {/* Alertes */}
      {alertes.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-rose-800">
              {alertes.length} matière{alertes.length > 1 ? 's' : ''} première{alertes.length > 1 ? 's' : ''} sous le seuil d&apos;alerte
            </p>
            <p className="text-xs text-rose-600 mt-0.5">
              {alertes.map((a) => a.matiere_premiere.nom).join(', ')}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Matières premières */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
            <Wheat className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-700">Matières premières</h3>
            <span className="ml-auto text-xs text-slate-400">{mp.length} articles</span>
          </div>
          {mp.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Aucune matière première</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {mp.map((stock) => {
                const alerte = stock.quantite_totale < SEUIL_ALERTE
                return (
                  <div key={stock.matiere_premiere.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {stock.matiere_premiere.nom}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {stock.lots.length} lot{stock.lots.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-semibold ${alerte ? 'text-rose-600' : 'text-slate-800'}`}>
                        {formatWeight(stock.quantite_totale)}
                      </p>
                      <Badge
                        label={alerte ? 'Stock bas' : 'OK'}
                        variant={alerte ? 'danger' : 'success'}
                        className="mt-0.5"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Produits finis */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
            <Package className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-700">Produits finis (lots)</h3>
            <span className="ml-auto text-xs text-slate-400">{pf.length} lots</span>
          </div>
          {pf.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Aucun lot de produit fini</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {pf.map((stock) => {
                const ratio = stock.quantite_restante / stock.lot_pf.quantite_initiale
                return (
                  <div key={stock.lot_pf.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {stock.lot_pf.formule?.nom ?? `Lot #${stock.lot_pf.id}`}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Coût : {formatCurrency(stock.lot_pf.cout_revient)}/kg
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatWeight(stock.quantite_restante)}
                      </p>
                      <Badge
                        label={ratio <= 0 ? 'Épuisé' : ratio < 0.2 ? 'Critique' : 'Disponible'}
                        variant={ratio <= 0 ? 'danger' : ratio < 0.2 ? 'warning' : 'success'}
                        className="mt-0.5"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
