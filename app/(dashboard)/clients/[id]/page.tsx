'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Phone, MapPin, Edit2, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { Client, Commande, PaginatedResponse } from '@/types'
import { AxiosError } from 'axios'
import { useEffect, useState } from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import Badge from '@/components/ui/Badge'

const schema = z.object({
  nom: z.string().min(2, 'Nom requis'),
  contact: z.string().optional(),
  adresse: z.string().optional(),
  annees_elevage: z.string().optional(),
  animaux_eleves: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editMode, setEditMode] = useState(false)

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const res = await api.get<Client>(`/clients/${id}`)
      return res.data
    },
  })

  const { data: commandesData } = useQuery({
    queryKey: ['client-commandes', id],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Commande>>('/commandes', {
        params: { client_id: id, limit: 10 },
      })
      return res.data
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (client) {
      reset({
        nom: client.nom,
        contact: client.contact,
        adresse: client.adresse,
        annees_elevage: String(client.annees_elevage || ''),
        animaux_eleves: client.animaux_eleves,
      })
    }
  }, [client, reset])

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.put(`/clients/${id}`, {
        nom: data.nom,
        contact: data.contact || '',
        adresse: data.adresse || '',
        annees_elevage: parseInt(data.annees_elevage || '0') || 0,
        animaux_eleves: data.animaux_eleves || '',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client mis à jour')
      setEditMode(false)
    },
    onError: (err: AxiosError<{ error: string }>) => {
      toast.error(err.response?.data?.error || 'Erreur')
    },
  })

  if (isLoading) return <LoadingSpinner />

  const paiementVariant = (statut: string) => {
    if (statut === 'cash') return 'success'
    if (statut === 'credit') return 'danger'
    return 'warning'
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour aux clients
      </Link>

      {/* Fiche client */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-700 font-bold text-sm">
                {client?.nom.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">{client?.nom}</h2>
              <p className="text-xs text-slate-400">Client #{id}</p>
            </div>
          </div>
          <button
            onClick={() => setEditMode(!editMode)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600 font-medium border border-slate-200 hover:border-emerald-300 px-3 py-1.5 rounded-lg transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            {editMode ? 'Annuler' : 'Modifier'}
          </button>
        </div>

        {editMode ? (
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom *</label>
              <input {...register('nom')}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
              <input {...register('contact')} type="tel"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresse</label>
              <input {...register('adresse')}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Animaux</label>
                <input {...register('animaux_eleves')}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Années élevage</label>
                <input {...register('annees_elevage')} type="number" min="0"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
            </div>
            <button type="submit" disabled={mutation.isPending}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {client?.contact && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {client.contact}
              </div>
            )}
            {client?.adresse && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {client.adresse}
              </div>
            )}
            {client?.animaux_eleves && (
              <div className="text-slate-600">
                <span className="text-slate-400 text-xs">Animaux : </span>
                {client.animaux_eleves}
              </div>
            )}
            {client?.annees_elevage != null && client.annees_elevage > 0 && (
              <div className="text-slate-600">
                <span className="text-slate-400 text-xs">Expérience : </span>
                {client.annees_elevage} ans
              </div>
            )}
          </div>
        )}
      </div>

      {/* Historique commandes */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-slate-400" />
            Historique des commandes
          </h3>
          <Link
            href={`/ventes/nouvelle?client_id=${id}`}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
          >
            + Nouvelle vente
          </Link>
        </div>

        {!commandesData?.data?.length ? (
          <p className="text-sm text-slate-400 text-center py-8">Aucune commande</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-left font-semibold text-slate-600 bg-slate-50">Date</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 bg-slate-50">Montant</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600 bg-slate-50">Paiement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commandesData.data.map((cmd) => (
                <tr key={cmd.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(cmd.date_heure)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {formatCurrency(cmd.montant)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      label={cmd.statut_paiement === 'cash' ? 'Cash' : cmd.statut_paiement === 'credit' ? 'Crédit' : 'Partiel'}
                      variant={paiementVariant(cmd.statut_paiement) as 'success' | 'danger' | 'warning'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
