'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import { LotPF } from '@/types'
import { formatCurrency, formatDate, formatWeight } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function LotPFDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useQuery({ queryKey: ['lot-pf', id], queryFn: async () => (await api.get<LotPF>(`/lots-pf/${id}`)).data })
  if (isLoading || !data) return <LoadingSpinner />
  return <div className="max-w-2xl space-y-5"><Link href="/stocks" className="inline-flex items-center gap-1.5 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" /> Retour aux stocks</Link><div className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="mb-5 font-semibold text-slate-800">Lot {data.numero_lot ?? `#${data.id}`}</h2><dl className="divide-y divide-slate-100"><Row label="Formule" value={data.formule_nom ?? data.formule?.nom ?? '—'} /><Row label="Quantité initiale" value={formatWeight(data.quantite_initiale)} /><Row label="Quantité restante" value={formatWeight(data.quantite_restante)} /><Row label="Coût de revient" value={`${formatCurrency(data.cout_revient)}/kg`} /><Row label="Date de production" value={formatDate(data.date_creation)} /><Row label="Date de péremption" value={data.date_peremption ? formatDate(data.date_peremption) : '—'} /><Row label="Statut" value={data.statut ?? '—'} /></dl><p className="mt-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Le lot est mis à jour uniquement par les ventes, annulations et ajustements tracés.</p></div></div>
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-6 py-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-800">{value}</dd></div>
}
