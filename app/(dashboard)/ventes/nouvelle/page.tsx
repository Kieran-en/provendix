'use client'

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  PackageCheck,
  PackagePlus,
  ReceiptText,
  UserRound,
  WalletCards,
  Wheat,
} from 'lucide-react'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import api from '@/lib/api'
import { Accessoire, Client, LotPF, MatierePremiere, PaginatedResponse, TypeProduit } from '@/types'
import { formatCurrency, formatWeight, getCurrencyLabel } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'

const formControl = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 read-only:cursor-not-allowed read-only:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:read-only:bg-slate-800'

const schema = z.object({
  client_id: z.string().min(1, 'Sélectionnez un client'),
  type_produit: z.enum(['pf', 'mp', 'accessoire']),
  produit_id: z.string().min(1, 'Sélectionnez un produit'),
  quantite: z.string().refine((value) => Number(value) > 0, 'Quantité invalide'),
  prix_unitaire: z.string().refine((value) => Number(value) > 0, 'Prix invalide'),
  mode_vente: z.enum(['cash', 'credit', 'partiel']),
  montant_paye_initial: z.string().optional(),
}).superRefine((data, context) => {
  if (data.mode_vente !== 'partiel') return
  const montant = Number(data.montant_paye_initial)
  const total = Number(data.quantite) * Number(data.prix_unitaire)
  if (!Number.isFinite(montant) || montant <= 0 || montant >= total) {
    context.addIssue({ code: 'custom', path: ['montant_paye_initial'], message: 'Le versement doit être supérieur à 0 et inférieur au total' })
  }
})

type Values = z.infer<typeof schema>

const productTypes = [
  { value: 'pf' as const, label: 'Produit fini', description: 'Formules produites', icon: PackageCheck },
  { value: 'mp' as const, label: 'Matière première', description: 'Vente directe au kg', icon: Wheat },
  { value: 'accessoire' as const, label: 'Accessoire', description: 'Équipement ou supplément', icon: PackagePlus },
]

function NouvelleVenteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canSeeCosts = user?.role === 'superviseur' || user?.role === 'admin'

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id: searchParams.get('client_id') ?? '',
      type_produit: 'pf',
      produit_id: '',
      quantite: '',
      prix_unitaire: '',
      mode_vente: 'cash',
      montant_paye_initial: '',
    },
  })

  const { data: clients } = useQuery({
    queryKey: ['clients-all'],
    queryFn: async () => (await api.get<PaginatedResponse<Client>>('/clients', { params: { limit: 200 } })).data.data,
  })
  const { data: lotsPF } = useQuery({
    queryKey: ['lots-pf-disponibles'],
    queryFn: async () => (await api.get<PaginatedResponse<LotPF>>('/lots-pf', { params: { limit: 200, disponible: true } })).data.data,
  })
  const { data: matieres } = useQuery({
    queryKey: ['matieres-premieres-disponibles'],
    queryFn: async () => (await api.get<PaginatedResponse<MatierePremiere>>('/matieres-premieres', { params: { limit: 200, disponible: true } })).data.data,
  })
  const { data: accessoires } = useQuery({
    queryKey: ['accessoires-disponibles'],
    queryFn: async () => (await api.get<PaginatedResponse<Accessoire>>('/accessoires', { params: { limit: 200, disponible: true } })).data.data,
  })

  const clientId = useWatch({ control, name: 'client_id' })
  const typeProduit = useWatch({ control, name: 'type_produit' })
  const produitId = useWatch({ control, name: 'produit_id' })
  const quantite = useWatch({ control, name: 'quantite' })
  const prixUnitaire = useWatch({ control, name: 'prix_unitaire' })
  const modeVente = useWatch({ control, name: 'mode_vente' })
  const montantPayeInitial = useWatch({ control, name: 'montant_paye_initial' })
  const id = Number(produitId)

  const selection = typeProduit === 'pf'
    ? (() => { const item = lotsPF?.find((lot) => lot.id === id); return item && { nom: item.formule_nom ?? `Lot ${item.numero_lot}`, stock: item.quantite_restante, unite: 'kg', prix: null, cout: item.cout_revient } })()
    : typeProduit === 'mp'
      ? (() => { const item = matieres?.find((mp) => mp.id === id); return item && { nom: item.nom, stock: item.quantite, unite: item.unite ?? 'kg', prix: item.prix_vente, cout: item.prix_achat_moyen } })()
      : (() => { const item = accessoires?.find((accessoire) => accessoire.id === id); return item && { nom: item.nom, stock: item.stock_disponible, unite: item.unite, prix: item.prix_vente, cout: item.prix_achat } })()

  const selectedClient = clients?.find((client) => client.id === Number(clientId))

  useEffect(() => {
    if (selection?.prix != null) setValue('prix_unitaire', String(selection.prix), { shouldValidate: true })
  }, [selection?.prix, setValue])

  const changerType = (type: TypeProduit) => {
    setValue('type_produit', type)
    setValue('produit_id', '')
    setValue('prix_unitaire', '')
    setValue('quantite', '')
  }

  const montantTotal = Number(quantite) > 0 && Number(prixUnitaire) > 0 ? Number(quantite) * Number(prixUnitaire) : 0
  const stockInsuffisant = Boolean(selection && Number(quantite) > selection.stock)
  const stockApres = selection && Number(quantite) > 0 ? selection.stock - Number(quantite) : null
  const marge = selection && montantTotal > 0 ? montantTotal - Number(quantite) * selection.cout : null
  const montantRegle = modeVente === 'cash' ? montantTotal : modeVente === 'partiel' ? Number(montantPayeInitial || 0) : 0
  const resteAPayer = Math.max(0, montantTotal - montantRegle)

  const mutation = useMutation({
    mutationFn: (data: Values) => api.post('/commandes', {
      client_id: Number(data.client_id),
      type_produit: data.type_produit,
      ...(data.type_produit === 'pf' ? { lot_pf_id: Number(data.produit_id), prix_unitaire: Number(data.prix_unitaire) } : {}),
      ...(data.type_produit === 'mp' ? { matiere_premiere_id: Number(data.produit_id) } : {}),
      ...(data.type_produit === 'accessoire' ? { accessoire_id: Number(data.produit_id) } : {}),
      quantite: Number(data.quantite),
      mode_paiement: data.mode_vente === 'cash' ? 'cash' : 'credit',
      montant_paye_initial: data.mode_vente === 'partiel' ? Number(data.montant_paye_initial) : 0,
    }),
    onSuccess: (response) => {
      for (const key of [['commandes'], ['lots-pf-disponibles'], ['matieres-premieres-disponibles'], ['accessoires-disponibles'], ['dashboard-stats']]) {
        queryClient.invalidateQueries({ queryKey: key })
      }
      toast.success('Vente enregistrée')
      router.push(`/ventes/${response.data.id}`)
    },
    onError: (error: AxiosError<{ error?: string; non_field_errors?: string[] }>) => {
      toast.error(error.response?.data?.error ?? error.response?.data?.non_field_errors?.[0] ?? 'Enregistrement impossible')
    },
  })

  const options = typeProduit === 'pf' ? lotsPF : typeProduit === 'mp' ? matieres : accessoires

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/ventes" className="mb-5 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-slate-500 transition hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400"><ArrowLeft className="h-4 w-4" /> Retour aux ventes</Link>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-5">
          <FormSection number="1" icon={UserRound} title="Client" description="Identifiez le client concerné par cette vente.">
            <Field label="Client" error={errors.client_id?.message}>
              <select {...register('client_id')} className={formControl}>
                <option value="">Sélectionner un client…</option>
                {clients?.map((client) => <option key={client.id} value={client.id}>{client.nom}</option>)}
              </select>
            </Field>
          </FormSection>

          <FormSection number="2" icon={PackageCheck} title="Produit et quantité" description="Le stock disponible sera contrôlé avant validation.">
            <fieldset>
              <legend className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Type de produit</legend>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {productTypes.map(({ value, label, description, icon: Icon }) => {
                  const active = typeProduit === value
                  return (
                    <button key={value} type="button" onClick={() => changerType(value)} aria-pressed={active} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}><Icon className="h-[18px] w-[18px]" /></span>
                      <span className="min-w-0"><span className="block text-xs font-bold sm:text-sm">{label}</span><span className="mt-0.5 hidden text-[10px] opacity-70 xl:block">{description}</span></span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <Field label="Produit" error={errors.produit_id?.message}>
              <select {...register('produit_id')} className={formControl}>
                <option value="">Sélectionner un produit…</option>
                {options?.map((item) => {
                  if (typeProduit === 'pf') { const lot = item as LotPF; return <option key={lot.id} value={lot.id}>{lot.formule_nom ?? lot.numero_lot} — {formatWeight(lot.quantite_restante)}</option> }
                  if (typeProduit === 'mp') { const mp = item as MatierePremiere; return <option key={mp.id} value={mp.id}>{mp.nom} — {formatWeight(mp.quantite)}</option> }
                  const accessoire = item as Accessoire
                  return <option key={accessoire.id} value={accessoire.id}>{accessoire.nom} — {accessoire.stock_disponible} {accessoire.unite}</option>
                })}
              </select>
              {selection && <span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Disponible : {selection.stock} {selection.unite}{canSeeCosts ? ` · Coût : ${formatCurrency(selection.cout)}/${selection.unite}` : ''}</span>}
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={`Quantité (${selection?.unite ?? 'unité'})`} error={errors.quantite?.message}>
                <input {...register('quantite')} type="number" min="0.001" step="0.001" placeholder="0" className={formControl} />
                {stockInsuffisant && <span className="mt-1.5 block text-xs font-semibold text-rose-600">Stock insuffisant</span>}
              </Field>
              <Field label={`Prix de vente (${getCurrencyLabel()}/${selection?.unite ?? 'unité'})`} error={errors.prix_unitaire?.message}>
                <input {...register('prix_unitaire')} type="number" min="0.01" step="0.01" placeholder="0" readOnly={typeProduit !== 'pf'} className={formControl} />
                {typeProduit !== 'pf' && <span className="mt-1.5 block text-xs font-semibold text-emerald-600 dark:text-emerald-400">Prix calculé automatiquement</span>}
              </Field>
            </div>

            {stockApres !== null && !stockInsuffisant && <div className="flex gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-3 text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p className="text-xs leading-5">Stock restant après la vente : <strong>{stockApres.toFixed(3)} {selection?.unite}</strong></p></div>}
          </FormSection>

          <FormSection number="3" icon={WalletCards} title="Paiement" description="Précisez comment le client règle cette vente.">
            <fieldset>
              <legend className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Mode de paiement</legend>
              <div className="grid grid-cols-3 gap-2.5">
                {(['cash', 'credit', 'partiel'] as const).map((mode) => (
                  <label key={mode} className="cursor-pointer">
                    <input {...register('mode_vente')} type="radio" value={mode} className="peer sr-only" />
                    <span className="block rounded-xl border border-slate-300 px-2 py-3 text-center text-xs font-semibold text-slate-600 transition peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700 peer-checked:ring-2 peer-checked:ring-emerald-500/10 dark:border-slate-700 dark:text-slate-300 dark:peer-checked:bg-emerald-500/10 dark:peer-checked:text-emerald-300 sm:text-sm">{mode === 'cash' ? 'Comptant' : mode === 'credit' ? 'Crédit' : 'Partiel'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {modeVente === 'partiel' && <Field label={`Premier versement (${getCurrencyLabel()})`} error={errors.montant_paye_initial?.message}><input {...register('montant_paye_initial')} type="number" min="1" step="1" placeholder="0" className={formControl} /></Field>}
          </FormSection>
        </div>

        <aside className="xl:sticky xl:top-20">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/30 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50"><div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-emerald-600" /><h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Récapitulatif</h2></div><p className="mt-1 text-xs text-slate-400">Vérifiez les informations avant validation.</p></div>
            <div className="space-y-4 p-5">
              <SummaryLine label="Client" value={selectedClient?.nom ?? 'Non sélectionné'} />
              <SummaryLine label="Produit" value={selection?.nom ?? 'Non sélectionné'} />
              <SummaryLine label="Quantité" value={selection && Number(quantite) > 0 ? `${quantite} ${selection.unite}` : '—'} />
              <SummaryLine label="Paiement" value={modeVente === 'cash' ? 'Comptant' : modeVente === 'credit' ? 'Crédit' : 'Partiel'} />
              <div className="border-t border-dashed border-slate-200 pt-4 dark:border-slate-700">
                <div className="flex items-end justify-between gap-3"><span className="text-sm font-semibold text-slate-500">Total</span><strong className="tabular-nums text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">{formatCurrency(montantTotal)}</strong></div>
                {montantTotal > 0 && modeVente !== 'cash' && <div className="mt-2 flex justify-between text-xs"><span className="text-slate-400">Reste à payer</span><strong className="tabular-nums text-amber-700 dark:text-amber-400">{formatCurrency(resteAPayer)}</strong></div>}
                {canSeeCosts && marge !== null && !stockInsuffisant && <div className="mt-2 flex justify-between text-xs"><span className="text-slate-400">Marge estimée</span><strong className={marge >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}>{formatCurrency(marge)}</strong></div>}
              </div>
            </div>
            <div className="space-y-2 border-t border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <button type="submit" disabled={mutation.isPending || stockInsuffisant} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/15 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{mutation.isPending ? 'Enregistrement…' : 'Valider la vente'}</button>
              <Link href="/ventes" className="block w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white">Annuler</Link>
            </div>
          </div>
        </aside>
      </form>
    </div>
  )
}

function FormSection({ number, icon: Icon, title, description, children }: { number: string; icon: React.ComponentType<{ className?: string }>; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Icon className="h-[18px] w-[18px]" /><span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[9px] font-bold text-white dark:bg-emerald-600">{number}</span></span><div><h2 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h2><p className="mt-0.5 text-xs leading-5 text-slate-400">{description}</p></div></div><div className="space-y-4">{children}</div></section>
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300"><span className="mb-2 block">{label}</span>{children}{error && <span className="mt-1.5 block text-xs font-semibold text-rose-600">{error}</span>}</label>
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-xs font-medium text-slate-400">{label}</span><span className="max-w-[65%] text-right text-xs font-bold text-slate-700 dark:text-slate-200">{value}</span></div>
}

export default function NouvelleVentePage() {
  return <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Chargement…</div>}><NouvelleVenteForm /></Suspense>
}
