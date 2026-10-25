// Plan de ejemplo para empezar rápido (el del autor de esta versión). Cada persona lo edita
// después con sus propios números. Solo enteros en COP.

import type { PlanItemInput } from '../services/plan'
import type { PlanKind } from '../types/domain'

type TemplateItem = { kind: PlanKind } & PlanItemInput

const line = (
  kind: PlanKind,
  name: string,
  amount: number,
  extra: Partial<PlanItemInput> = {},
): TemplateItem => ({
  kind,
  name,
  amount,
  groupName: null,
  startsOn: null,
  endsOn: null,
  ...extra,
})

const card = (name: string, amount: number) =>
  line('expense', name, amount, { groupName: 'Tarjeta' })

export const EXAMPLE_PLAN: TemplateItem[] = [
  // Fondo semestral de 12.300.000 repartido en 6 cuotas de 2.050.000 (julio a diciembre 2026).
  line('income', 'Fondo semestral (cuota)', 2_050_000, {
    startsOn: '2026-07-01',
    endsOn: '2026-12-31',
  }),
  line('income', 'Mamá', 600_000),
  line('income', 'Mamá (adicional)', 150_000),
  line('income', 'Abuelo (bolsillos)', 550_000),
  line('income', 'Restante del mes anterior', 200_000),
  line('expense', 'Gimnasio', 120_000),
  line('expense', 'Gasolina', 650_000),
  card('iCloud', 21_000),
  card('Cuota de manejo', 18_000),
  card('Ahorros', 15_000),
  card('Google', 31_000),
  card('Negocios', 31_000),
  card('Visa', 44_000),
  card('Adobe', 33_000),
  card('Verificado Instagram', 34_000),
  card('Claude', 66_000),
  line('saving', 'Ahorro mensual', 1_200_000),
]
