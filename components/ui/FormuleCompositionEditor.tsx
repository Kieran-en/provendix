'use client'

import { useFieldArray, Control, UseFormRegister, FieldErrors } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { MatierePremiere } from '@/types'
import { z } from 'zod'

// Schéma partagé — les pages formules l'importent et en dérivent leur type
export const formuleSchema = z.object({
  nom: z.string().min(2, 'Nom requis'),
  code: z
    .string()
    .min(2, 'Code requis')
    .regex(/^[A-Z0-9_-]+$/, 'Code : majuscules, chiffres, tirets uniquement'),
  compositions: z
    .array(
      z.object({
        matiere_premiere_id: z.string().min(1, 'MP requise'),
        quantite: z
          .string()
          .min(1, 'Quantité requise')
          .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Invalide'),
        aliment_fourni: z.string(),
      })
    )
    .min(1, 'Ajoutez au moins un ingrédient'),
})

export type FormuleFormValues = z.infer<typeof formuleSchema>

interface Props {
  control: Control<FormuleFormValues>
  register: UseFormRegister<FormuleFormValues>
  errors: FieldErrors<FormuleFormValues>
  matieresPremières: MatierePremiere[]
}

export default function FormuleCompositionEditor({ control, register, errors, matieresPremières }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: 'compositions' })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          Composition <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={() => append({ matiere_premiere_id: '', quantite: '', aliment_fourni: '' })}
          className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter un ingrédient
        </button>
      </div>

      {fields.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4 border-2 border-dashed border-slate-200 rounded-lg">
          Aucun ingrédient. Cliquez sur &quot;Ajouter un ingrédient&quot;.
        </p>
      )}

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[1fr_100px_auto] gap-2 items-start bg-slate-50 rounded-lg p-3">
            <div>
              <select
                {...register(`compositions.${index}.matiere_premiere_id`)}
                className="w-full px-2.5 py-2 rounded-md border border-slate-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Choisir MP...</option>
                {matieresPremières.map((mp) => (
                  <option key={mp.id} value={mp.id}>
                    {mp.nom}
                  </option>
                ))}
              </select>
              {errors.compositions?.[index]?.matiere_premiere_id && (
                <p className="text-red-500 text-xs mt-0.5">
                  {errors.compositions[index]?.matiere_premiere_id?.message}
                </p>
              )}
            </div>

            <div>
              <div className="relative">
                <input
                  {...register(`compositions.${index}.quantite`)}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="kg"
                  className="w-full px-2.5 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-8"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">kg</span>
              </div>
              {errors.compositions?.[index]?.quantite && (
                <p className="text-red-500 text-xs mt-0.5">
                  {errors.compositions[index]?.quantite?.message}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => remove(index)}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition mt-0.5"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
