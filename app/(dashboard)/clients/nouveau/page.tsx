'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { AxiosError } from 'axios'

const schema = z.object({
  nom: z.string().min(2, 'Nom requis'),
  contact: z.string().optional(),
  adresse: z.string().optional(),
  annees_elevage: z.string().optional(),
  animaux_eleves: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NouveauClientPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post('/clients', {
        nom: data.nom,
        contact: data.contact || '',
        adresse: data.adresse || '',
        annees_elevage: parseInt(data.annees_elevage || '0') || 0,
        animaux_eleves: data.animaux_eleves || '',
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client créé avec succès')
      router.push(`/clients/${res.data.id}`)
    },
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur lors de la création')
    },
  })

  return (
    <div className="max-w-lg">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux clients
      </Link>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-5">Nouvelle fiche client</h2>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nom / Raison sociale <span className="text-red-500">*</span>
            </label>
            <input
              {...register('nom')}
              placeholder="Ex: Ferme El Baraka"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
            {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
            <input
              {...register('contact')}
              type="tel"
              placeholder="0XX XX XX XX"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresse</label>
            <input
              {...register('adresse')}
              placeholder="Wilaya, commune..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Animaux élevés</label>
              <input
                {...register('animaux_eleves')}
                placeholder="Poulets, bovins..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Années d&apos;élevage</label>
              <input
                {...register('annees_elevage')}
                type="number"
                min="0"
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              href="/clients"
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition text-center"
            >
              Annuler
            </Link>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {mutation.isPending ? 'Création...' : 'Créer le client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
