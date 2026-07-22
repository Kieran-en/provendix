'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import { Production } from '@/types'
import { formatCurrency, formatDate, formatWeight } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function ProductionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useQuery({ queryKey: ['production', id], queryFn: async () => (await api.get<Production>(`/productions/${id}`)).data })
  if (isLoading || !data) return <LoadingSpinner />
  return <div className="max-w-3xl space-y-5"><Link href="/production" className="inline-flex items-center gap-1.5 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" /> Retour aux productions</Link><div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6"><div><h2 className="font-semibold text-slate-800">{data.formule_nom}</h2><p className="text-xs text-slate-500">{formatWeight(data.quantite)} produits le {formatDate(data.date ?? data.date_production)}</p></div>{data.lot_pf_detail && <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3"><div><span className="block text-xs text-slate-500">Lot produit fini</span><strong>{data.lot_pf_detail.numero_lot}</strong></div><div><span className="block text-xs text-slate-500">Stock restant</span><strong>{formatWeight(data.lot_pf_detail.quantite_restante)}</strong></div><div><span className="block text-xs text-slate-500">Coût de revient</span><strong>{formatCurrency(data.lot_pf_detail.cout_revient)}/kg</strong></div></div>}<div><h3 className="mb-2 text-sm font-semibold text-slate-700">Lots de matières consommés</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left text-slate-500"><th className="p-2">Matière</th><th className="p-2">Lot</th><th className="p-2 text-right">Quantité</th><th className="p-2 text-right">Coût/kg</th></tr></thead><tbody className="divide-y divide-slate-100">{data.consommations_lots?.map((ligne) => <tr key={ligne.lot_fournisseur_id}><td className="p-2">{ligne.matiere_premiere}</td><td className="p-2 font-mono text-xs">{ligne.numero_lot}</td><td className="p-2 text-right">{formatWeight(ligne.quantite)}</td><td className="p-2 text-right">{formatCurrency(ligne.cout_unitaire)}</td></tr>)}</tbody></table></div></div><p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Une production terminée reste consultable mais n’est pas modifiable ni supprimable afin de préserver la traçabilité.</p></div></div>
}
