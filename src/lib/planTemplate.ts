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

const membership = (name: string, amount: number) =>
  line('expense', name, amount, { groupName: 'Membresías' })

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
  line('expense', 'Gasolina', 650_000, { tracked: true }),
  membership('iCloud', 21_000),
  membership('Cuota de manejo', 18_000),
  membership('Ahorros', 15_000),
  membership('Google', 31_000),
  membership('Negocios', 31_000),
  membership('Visa', 44_000),
  membership('Adobe', 33_000),
  membership('Verificado Instagram', 34_000),
  membership('Claude', 66_000),
  line('saving', 'Pago de tarjetas y deudas', 1_200_000),
]
