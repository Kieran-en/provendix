'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import { LotFournisseur } from '@/types'
import { formatCurrency, formatDate, formatWeight } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function LotFournisseurDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useQuery({ queryKey: ['lot-fournisseur', id], queryFn: async () => (await api.get<LotFournisseur>(`/lots-fournisseurs/${id}`)).data })
  if (isLoading || !data) return <LoadingSpinner />
  const rows = [
    ['Matière première', data.mp_nom ?? `MP #${data.matiere_premiere_id}`],
    ['Numéro de lot', data.numero_lot], ['Fournisseur', data.fournisseur],
    ['Quantité initiale', formatWeight(data.quantite_initiale)], ['Quantité restante', formatWeight(data.quantite_restante)],
    ['Coût d’achat', `${formatCurrency(data.cout_kg)}/kg`], ['Réception', formatDate(data.date_reception)],
    ['Péremption', data.date_peremption ? formatDate(data.date_peremption) : 'Non définie'], ['Statut', data.statut],
  ]
  return <div className="max-w-2xl space-y-5"><Link href="/lots-fournisseurs" className="inline-flex items-center gap-1.5 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" /> Retour aux lots</Link><div className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="mb-5 font-semibold text-slate-800">Détail du lot fournisseur</h2><dl className="divide-y divide-slate-100">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-6 py-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-800">{value}</dd></div>)}</dl><p className="mt-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Une réception validée n’est ni modifiable ni supprimable afin de préserver les stocks et la traçabilité.</p></div></div>
}
