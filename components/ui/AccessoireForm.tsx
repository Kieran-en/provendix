'use client'

import Image from 'next/image'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import api from '@/lib/api'
import { Accessoire } from '@/types'
import { getCurrencyLabel } from '@/lib/utils'

const inputClassName = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white'

const schema = z.object({
  nom: z.string().trim().min(2, 'Nom requis'),
  description: z.string(),
  unite: z.string().trim().min(1, 'Unité requise'),
  prix_achat: z.string().refine((v) => Number(v) >= 0, 'Prix invalide'),
  prix_vente: z.string().refine((v) => Number(v) > 0, 'Prix invalide'),
  stock_disponible: z.string().refine((v) => Number(v) >= 0, 'Stock invalide'),
  seuil_alerte: z.string().refine((v) => Number(v) >= 0, 'Seuil invalide'),
  actif: z.boolean(),
  photo: z.custom<FileList>().optional(),
})

type Values = z.infer<typeof schema>

interface Props {
  accessoire?: Accessoire
}

export default function AccessoireForm({ accessoire }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      nom: '', description: '', unite: 'pièce', prix_achat: '0', prix_vente: '',
      stock_disponible: '0', seuil_alerte: '0', actif: true,
    },
  })

  useEffect(() => {
    if (!accessoire) return
    reset({
      nom: accessoire.nom,
      description: accessoire.description ?? '',
      unite: accessoire.unite,
      prix_achat: String(accessoire.prix_achat),
      prix_vente: String(accessoire.prix_vente),
      stock_disponible: String(accessoire.stock_disponible),
      seuil_alerte: String(accessoire.seuil_alerte),
      actif: accessoire.actif,
    })
  }, [accessoire, reset])

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const body = new FormData()
      body.append('nom', values.nom)
      body.append('description', values.description)
      body.append('unite', values.unite)
      body.append('prix_achat', values.prix_achat)
      body.append('prix_vente', values.prix_vente)
      body.append('stock_disponible', values.stock_disponible)
      body.append('seuil_alerte', values.seuil_alerte)
      body.append('actif', String(values.actif))
      const photo = values.photo?.item(0)
      if (photo) body.append('photo', photo)
      if (accessoire) return api.patch(`/accessoires/${accessoire.id}`, body)
      return api.post('/accessoires', body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessoires'] })
      toast.success(accessoire ? 'Accessoire mis à jour' : 'Accessoire ajouté')
      router.push('/accessoires')
    },
    onError: (error: AxiosError<{ error?: string; photo?: string[] }>) => {
      toast.error(error.response?.data?.error ?? error.response?.data?.photo?.[0] ?? 'Enregistrement impossible')
    },
  })

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-5">
      {accessoire?.photo_url && (
        <Image
          src={accessoire.photo_url}
          alt={accessoire.nom}
          width={112}
          height={112}
          unoptimized
          className="h-28 w-28 rounded-2xl border border-slate-200 object-cover shadow-sm dark:border-slate-700"
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" error={errors.nom?.message}>
          <input {...register('nom')} className={inputClassName} placeholder="Ex. Abreuvoir 10 L" />
        </Field>
        <Field label="Unité" error={errors.unite?.message}>
          <input {...register('unite')} className={inputClassName} placeholder="pièce" />
        </Field>
        <Field label={`Prix d’achat (${getCurrencyLabel()})`} error={errors.prix_achat?.message}>
          <input {...register('prix_achat')} type="number" min="0" step="0.01" className={inputClassName} />
        </Field>
        <Field label={`Prix de vente (${getCurrencyLabel()})`} error={errors.prix_vente?.message}>
          <input {...register('prix_vente')} type="number" min="0.01" step="0.01" className={inputClassName} />
        </Field>
        <Field label="Stock disponible" error={errors.stock_disponible?.message}>
          <input {...register('stock_disponible')} type="number" min="0" step="0.001" className={inputClassName} />
        </Field>
        <Field label="Seuil d’alerte" error={errors.seuil_alerte?.message}>
          <input {...register('seuil_alerte')} type="number" min="0" step="0.001" className={inputClassName} />
        </Field>
      </div>

      <Field label="Description">
        <textarea {...register('description')} rows={3} className={`${inputClassName} resize-none`} />
      </Field>
      <Field label="Photo (JPEG, PNG ou WebP, 5 Mo maximum)" error={errors.photo?.message as string | undefined}>
        <input {...register('photo')} type="file" accept="image/jpeg,image/png,image/webp" className={inputClassName} />
      </Field>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
        <input {...register('actif')} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-emerald-600 accent-emerald-600" />
        Disponible dans le catalogue de vente
      </label>

      <div className="flex gap-3">
        <button type="button" onClick={() => router.push('/accessoires')} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          Annuler
        </button>
        <button type="submit" disabled={mutation.isPending} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/15 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer
        </button>
      </div>
    </form>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
      <span className="mb-1.5 block">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  )
}
