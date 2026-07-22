'use client'

import { useFieldArray, useWatch, Control, UseFormRegister, FieldErrors } from 'react-hook-form'
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
        pourcentage: z
          .string()
          .min(1, 'Pourcentage requis')
          .refine((v) => {
            const value = parseFloat(v)
            return !isNaN(value) && value > 0 && value <= 100
          }, 'Valeur attendue entre 0 et 100'),
      })
    )
    .min(1, 'Ajoutez au moins un ingrédient'),
}).superRefine((data, ctx) => {
  const total = data.compositions.reduce((sum, item) => sum + (parseFloat(item.pourcentage) || 0), 0)
  if (Math.abs(total - 100) > 0.001) {
    ctx.addIssue({
      code: 'custom',
      path: ['compositions'],
      message: `La composition doit totaliser exactement 100 % (actuellement ${total.toFixed(3)} %)`,
    })
  }
  const ids = data.compositions.map((item) => item.matiere_premiere_id).filter(Boolean)
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', path: ['compositions'], message: 'Une matière première ne peut apparaître qu’une fois' })
  }
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
  const compositions = useWatch({ control, name: 'compositions' })
  const total = (compositions ?? []).reduce(
    (sum, item) => sum + (parseFloat(item?.pourcentage ?? '') || 0),
    0
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          Composition <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-3">
          <span className={Math.abs(total - 100) < 0.001 ? 'text-xs font-medium text-emerald-600' : 'text-xs font-medium text-amber-600'}>
            Total : {total.toFixed(3)} / 100 %
          </span>
          <button
          type="button"
          onClick={() => append({ matiere_premiere_id: '', pourcentage: '' })}
          className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter un ingrédient
          </button>
        </div>
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
                  {...register(`compositions.${index}.pourcentage`)}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="%"
                  className="w-full px-2.5 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-8"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
              </div>
              {errors.compositions?.[index]?.pourcentage && (
                <p className="text-red-500 text-xs mt-0.5">
                  {errors.compositions[index]?.pourcentage?.message}
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
