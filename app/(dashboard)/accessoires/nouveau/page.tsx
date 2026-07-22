import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AccessoireForm from '@/components/ui/AccessoireForm'

export default function NouvelAccessoirePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/accessoires" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400">
        <ArrowLeft className="h-4 w-4" /> Retour aux accessoires
      </Link>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">Catalogue commercial</p>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">Nouvel accessoire ou supplément</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Renseignez son prix, son stock et sa présentation dans le catalogue.</p>
        </div>
        <AccessoireForm />
      </div>
    </div>
  )
}
