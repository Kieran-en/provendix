'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Calendar, ChevronRight, Eye, FilterX, Plus, Search, ShoppingCart } from 'lucide-react'
import api from '@/lib/api'
import { Commande, PaginatedResponse } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const paiementConfig = {
  non_paye: { label: 'Non payé', variant: 'danger' as const },
  partiel: { label: 'Partiel', variant: 'warning' as const },
  paye: { label: 'Payé', variant: 'success' as const },
}

const produitLabels = {
  pf: 'Produit fini',
  mp: 'Matière première',
  accessoire: 'Accessoire',
}

export default function VentesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dateFilter, setDateFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['commandes', page, search, dateFilter],
    queryFn: async () => (await api.get<PaginatedResponse<Commande>>('/commandes', {
      params: { page, limit: 20, search: search || undefined, date: dateFilter || undefined },
    })).data,
  })

  const items = data?.data ?? []
  const total = data?.total ?? 0
  const hasFilters = Boolean(search || dateFilter)

  const resetFilters = () => {
    setSearch('')
    setDateFilter('')
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">Historique commercial</p>
            <div className="mt-1 flex items-baseline gap-2"><h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Toutes les ventes</h2><span className="text-sm font-medium text-slate-400">{total}</span></div>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <label className="relative min-w-0 flex-1 sm:w-72">
              <span className="sr-only">Rechercher une vente</span>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="search" placeholder="Client ou produit…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </label>
            <label className="relative sm:w-44">
              <span className="sr-only">Filtrer par date</span>
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1) }} className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" />
            </label>
            {hasFilters && <button type="button" onClick={resetFilters} aria-label="Effacer les filtres" title="Effacer les filtres" className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"><FilterX className="h-4 w-4" /></button>}
            <Link href="/ventes/nouvelle" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/15 transition hover:-translate-y-0.5 hover:shadow-lg">
              <Plus className="h-4 w-4" /> Nouvelle vente
            </Link>
          </div>
        </div>
      </section>

      {isLoading ? <LoadingSpinner /> : items.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="Aucune vente" description={hasFilters ? 'Aucune vente ne correspond aux filtres sélectionnés.' : 'Enregistrez votre première vente.'} action={hasFilters ? <button type="button" onClick={resetFilters} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Effacer les filtres</button> : <Link href="/ventes/nouvelle" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Nouvelle vente</Link>} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-slate-50/80 dark:bg-slate-950/60">
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Client</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Produit</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Date & heure</th>
                    <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Montant</th>
                    <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">Paiement</th>
                    <th className="w-20 px-5 py-3.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((commande) => {
                    const paiement = paiementConfig[commande.statut_paiement]
                    return (
                      <tr key={commande.id} className="group transition hover:bg-emerald-50/35 dark:hover:bg-emerald-500/[0.04]">
                        <td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar name={commande.client_nom} /><span className="font-semibold text-slate-800 dark:text-slate-100">{commande.client_nom ?? `Client #${commande.client}`}</span></div></td>
                        <td className="px-5 py-4"><span className="font-semibold text-slate-700 dark:text-slate-200">{commande.produit_nom}</span><span className="mt-0.5 block text-xs text-slate-400">{produitLabels[commande.type_produit]}</span></td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDateTime(commande.date_commande)}</td>
                        <td className="tabular-nums px-5 py-4 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(commande.montant_total ?? commande.montant)}</td>
                        <td className="px-5 py-4 text-center"><Badge label={paiement.label} variant={paiement.variant} /></td>
                        <td className="px-5 py-4 text-right"><Link href={`/ventes/${commande.id}`} aria-label={`Voir la vente de ${commande.client_nom ?? `client ${commande.client}`}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white hover:text-emerald-600 hover:shadow-sm dark:hover:bg-slate-800"><Eye className="h-4 w-4" /></Link></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((commande) => {
              const paiement = paiementConfig[commande.statut_paiement]
              return (
                <Link key={commande.id} href={`/ventes/${commande.id}`} className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Avatar name={commande.client_nom} /><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{commande.client_nom ?? `Client #${commande.client}`}</p><p className="mt-0.5 text-xs text-slate-400">{formatDateTime(commande.date_commande)}</p></div></div><Badge label={paiement.label} variant={paiement.variant} /></div>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{commande.produit_nom}</p><p className="mt-0.5 text-[11px] text-slate-400">{produitLabels[commande.type_produit]}</p></div><div className="flex shrink-0 items-center gap-1"><span className="tabular-nums text-base font-extrabold text-slate-950 dark:text-white">{formatCurrency(commande.montant_total ?? commande.montant)}</span><ChevronRight className="h-4 w-4 text-slate-300" /></div></div>
                </Link>
              )
            })}
          </div>

          {total > 20 && <Pagination page={page} total={total} onPage={setPage} />}
        </>
      )}
    </div>
  )
}

function Avatar({ name }: { name?: string }) {
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">{(name ?? 'C').charAt(0).toUpperCase()}</span>
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.ceil(total / 20)
  return <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-medium text-slate-500">Page {page} sur {pages}</p><div className="flex gap-2"><button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Précédent</button><button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Suivant</button></div></div>
}
