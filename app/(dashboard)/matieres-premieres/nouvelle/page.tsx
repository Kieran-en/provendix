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
  nom: z.string().min(2, 'Nom requis (min. 2 caractères)'),
  prix_kg: z
    .string()
    .min(1, 'Prix requis')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Prix invalide'),
})

type FormData = z.infer<typeof schema>

export default function NouvelleMPPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post('/matieres-premieres', {
        nom: data.nom,
        prix_kg: parseFloat(data.prix_kg),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matieres-premieres'] })
      toast.success('Matière première créée avec succès')
      router.push('/matieres-premieres')
    },
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur lors de la création')
    },
  })

  return (
    <div className="max-w-lg">
      {/* Back */}
      <Link
        href="/matieres-premieres"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux matières premières
      </Link>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-5">Nouvelle matière première</h2>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nom de la MP <span className="text-red-500">*</span>
            </label>
            <input
              {...register('nom')}
              type="text"
              placeholder="Ex: Maïs, Son de blé, Tourteau de soja..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
            {errors.nom && (
              <p className="text-red-500 text-xs mt-1">{errors.nom.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Prix d&apos;achat (DA/kg) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                {...register('prix_kg')}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition pr-12"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                DA/kg
              </span>
            </div>
            {errors.prix_kg && (
              <p className="text-red-500 text-xs mt-1">{errors.prix_kg.message}</p>
            )}
          </div>

          <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
            Le stock initial sera de 0 kg. Il augmentera automatiquement lors de la réception de lots fournisseurs.
          </p>

          <div className="flex gap-3 pt-2">
            <Link
              href="/matieres-premieres"
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
              {mutation.isPending ? 'Création...' : 'Créer la MP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
