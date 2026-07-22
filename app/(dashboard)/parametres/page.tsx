'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { Settings, Save, Building2, Bell, Clock, DollarSign } from 'lucide-react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { setCurrencyCode } from '@/lib/utils'

interface Parametre {
  id: number
  cle: string
  valeur: string
  description: string
}

interface ParametresResponse {
  data: Parametre[]
}

const PARAM_META: Record<string, { label: string; description: string; icon: React.ComponentType<{ className?: string }>; type: string }> = {
  nom_provenderie:     { label: 'Nom de la provenderie', description: 'Apparaît sur les factures imprimées', icon: Building2, type: 'text' },
  seuil_alerte_stock:  { label: 'Seuil d\'alerte stock par défaut (kg)', description: 'Valeur utilisée si aucun seuil n\'est défini sur la MP', icon: Bell, type: 'number' },
  duree_peremption_pf: { label: 'Durée péremption PF (jours)', description: 'Durée de péremption par défaut des lots de produits finis', icon: Clock, type: 'number' },
  devise:              { label: 'Devise', description: 'XAF (Afrique centrale) ou XOF (Afrique de l’Ouest), affiché FCFA', icon: DollarSign, type: 'select' },
  coefficient_transformation: { label: 'Coefficient de transformation', description: 'Majoration appliquée au coût des matières pour calculer le coût de revient', icon: DollarSign, type: 'number' },
  marge_vente_mp: { label: 'Marge sur les matières premières (%)', description: 'Marge ajoutée automatiquement au prix d’achat moyen (20 % par défaut)', icon: DollarSign, type: 'number' },
}

const DEFAULTS: Record<string, string> = {
  nom_provenderie:     'PROVENDIX',
  seuil_alerte_stock:  '500',
  duree_peremption_pf: '180',
  devise:              'XAF',
  coefficient_transformation: '1.08',
}

export default function ParametresPage() {
  const queryClient = useQueryClient()
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery<ParametresResponse>({
    queryKey: ['parametres'],
    queryFn: async () => {
      const res = await api.get<ParametresResponse>('/parametres')
      return res.data
    },
  })

  const serverValues = useMemo(() => {
    const loaded: Record<string, string> = { ...DEFAULTS }
    if (data?.data) {
      for (const p of data.data) {
        loaded[p.cle] = p.valeur
      }
    }
    return loaded
  }, [data])
  const values = { ...serverValues, ...overrides }

  const mutation = useMutation({
    mutationFn: async (params: Record<string, string>) => {
      await api.post('/parametres/bulk_update', { params })
    },
    onSuccess: () => {
      setCurrencyCode(values.devise)
      toast.success('Paramètres enregistrés')
      queryClient.invalidateQueries({ queryKey: ['parametres'] })
    },
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  })

  const handleSave = () => {
    mutation.mutate(values)
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Paramètres système</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(PARAM_META).map(([cle, meta]) => {
          const Icon = meta.icon
          return (
            <div
              key={cle}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
                    {meta.label}
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{meta.description}</p>
                  {meta.type === 'select' ? (
                    <select
                      value={values[cle] ?? 'XAF'}
                      onChange={(e) => setOverrides((prev) => ({ ...prev, [cle]: e.target.value }))}
                      className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="XAF">XAF — Franc CFA d’Afrique centrale</option>
                      <option value="XOF">XOF — Franc CFA d’Afrique de l’Ouest</option>
                    </select>
                  ) : (
                    <input
                      type={meta.type}
                      min={meta.type === 'number' ? '0.01' : undefined}
                      step={cle === 'coefficient_transformation' ? '0.01' : undefined}
                      value={values[cle] ?? ''}
                      onChange={(e) => setOverrides((prev) => ({ ...prev, [cle]: e.target.value }))}
                      className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
