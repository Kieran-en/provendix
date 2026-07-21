'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Edit2, ImageOff, PackageCheck, PackagePlus, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import api from '@/lib/api'
import { Accessoire, PaginatedResponse } from '@/types'
import { formatCurrency } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function AccessoiresPage() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['accessoires', search],
    queryFn: async () => (await api.get<PaginatedResponse<Accessoire>>('/accessoires', { params: { search: search || undefined, limit: 200 } })).data,
  })
  const mutation = useMutation({
    mutationFn: (id: number) => api.delete(`/accessoires/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessoires'] })
      toast.success('Accessoire supprimé ou archivé')
    },
    onError: (error: AxiosError<{ error?: string }>) => toast.error(error.response?.data?.error ?? 'Action impossible'),
  })

  const items = data?.data ?? []
  const lowStock = items.filter((item) => item.actif && item.stock_disponible <= item.seuil_alerte).length
  const activeItems = items.filter((item) => item.actif).length

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">Catalogue commercial</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">Accessoires & suppléments</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">Gérez les équipements et produits complémentaires proposés à la vente.</p>
          </div>
          <Link href="/accessoires/nouveau" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/15 transition hover:-translate-y-0.5"><Plus className="h-4 w-4" /> Nouvel accessoire</Link>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/40 sm:max-w-md sm:border-r">
          <MiniStat icon={PackageCheck} label="Articles actifs" value={activeItems} />
          <MiniStat icon={AlertTriangle} label="Stocks faibles" value={lowStock} danger={lowStock > 0} />
        </div>
      </section>

      <div className="relative max-w-md">
        <label>
          <span className="sr-only">Rechercher un accessoire</span>
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Rechercher dans le catalogue…" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </label>
      </div>

      {isLoading ? <LoadingSpinner /> : items.length === 0 ? (
        <EmptyState icon={PackagePlus} title="Aucun accessoire" description={search ? 'Aucun article ne correspond à votre recherche.' : 'Ajoutez des abreuvoirs, poussins, poulets ou autres suppléments.'} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((item) => {
            const alerte = item.stock_disponible <= item.seuil_alerte
            return (
              <article key={item.id} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-none">
                <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 to-emerald-50 dark:from-slate-800 dark:to-emerald-950/40">
                  {item.photo_url ? <Image src={item.photo_url} alt={item.nom} width={520} height={320} unoptimized className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <ImageOff className="h-10 w-10 text-slate-300 dark:text-slate-600" />}
                  <div className="absolute left-3 top-3"><Badge label={!item.actif ? 'Archivé' : alerte ? 'Stock bas' : 'Disponible'} variant={!item.actif || alerte ? 'danger' : 'success'} /></div>
                </div>
                <div className="p-4">
                  <div className="min-h-14"><h3 className="font-extrabold text-slate-900 dark:text-white">{item.nom}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description || 'Sans description'}</p></div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60"><div><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Stock</span><strong className="tabular-nums mt-1 block text-sm text-slate-800 dark:text-slate-100">{item.stock_disponible} {item.unite}</strong></div><div className="text-right"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Prix</span><strong className="tabular-nums mt-1 block text-sm text-emerald-700 dark:text-emerald-400">{formatCurrency(item.prix_vente)}</strong></div></div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800"><Link href={`/accessoires/${item.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"><Edit2 className="h-3.5 w-3.5" /> Modifier</Link><button type="button" onClick={() => confirm(`Supprimer ou archiver « ${item.nom} » ?`) && mutation.mutate(item.id)} aria-label={`Supprimer ou archiver ${item.nom}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" title="Supprimer ou archiver"><Trash2 className="h-4 w-4" /></button></div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MiniStat({ icon: Icon, label, value, danger = false }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; danger?: boolean }) {
  return <div className="flex items-center gap-3 border-r border-slate-100 px-5 py-3.5 last:border-r-0 dark:border-slate-800"><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${danger ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'}`}><Icon className="h-4 w-4" /></span><div><strong className="tabular-nums block text-lg leading-5 text-slate-900 dark:text-white">{value}</strong><span className="text-[10px] font-semibold text-slate-400">{label}</span></div></div>
}
