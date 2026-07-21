'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { MatierePremiere, PaginatedResponse } from '@/types'
import { AxiosError } from 'axios'
import FormuleCompositionEditor, { FormuleFormValues, formuleSchema } from '@/components/ui/FormuleCompositionEditor'

const schema = formuleSchema

export default function NouvelleFormulePage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: mpList } = useQuery({
    queryKey: ['matieres-premieres-all'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<MatierePremiere>>('/matieres-premieres', {
        params: { limit: 200 },
      })
      return res.data.data
    },
  })

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormuleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { compositions: [] },
  })

  const mutation = useMutation({
    mutationFn: (data: FormuleFormValues) =>
      api.post('/formules', {
        nom: data.nom,
        code: data.code.toUpperCase(),
        compositions: data.compositions.map((c) => ({
          mp_id: parseInt(c.matiere_premiere_id),
          pourcentage: parseFloat(c.pourcentage),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formules'] })
      toast.success('Formule créée avec succès')
      router.push('/formules')
    },
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur lors de la création')
    },
  })

  return (
    <div className="max-w-2xl">
      <Link
        href="/formules"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux formules
      </Link>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-5">Nouvelle formule standard</h2>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          {/* Infos générales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nom de la formule <span className="text-red-500">*</span>
              </label>
              <input
                {...register('nom')}
                placeholder="Ex: Poulet chair 0-21j"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Code unique <span className="text-red-500">*</span>
              </label>
              <input
                {...register('code')}
                placeholder="Ex: PC-0021"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition uppercase"
                style={{ textTransform: 'uppercase' }}
              />
              {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
            </div>
          </div>

          {/* Séparateur */}
          <div className="border-t border-slate-100" />

          {/* Composition */}
          <FormuleCompositionEditor
            control={control}
            register={register}
            errors={errors}
            matieresPremières={mpList ?? []}
          />
          {errors.compositions && typeof errors.compositions.message === 'string' && (
            <p className="text-red-500 text-xs">{errors.compositions.message}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Link
              href="/formules"
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
              {mutation.isPending ? 'Création...' : 'Créer la formule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
