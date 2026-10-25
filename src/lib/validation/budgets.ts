import { z } from 'zod'
import { moneyField } from './movements'

export const budgetSchema = z
  .object({
    kind: z.enum(['category', 'total', 'free']),
    name: z.string().trim().max(60, 'Máximo 60 caracteres.'),
    categoryId: z.string(),
    amount: moneyField,
    period: z.enum(['month', 'week']),
  })
  .superRefine((value, context) => {
    if (value.kind === 'category' && !value.categoryId)
      context.addIssue({ code: 'custom', path: ['categoryId'], message: 'Elige una categoría.' })
    if (value.kind !== 'category' && !value.name.trim())
      context.addIssue({ code: 'custom', path: ['name'], message: 'Ponle un nombre.' })
  })

export type BudgetFormValues = z.infer<typeof budgetSchema>
