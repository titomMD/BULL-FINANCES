import { z } from 'zod'

/** Contraseña nueva (Ajustes y restablecer): mínimo 8, con letras y números, repetida igual. */
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres.')
      .regex(/[A-Za-z]/, 'Incluye al menos una letra.')
      .regex(/\d/, 'Incluye al menos un número.'),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    message: 'Las contraseñas no coinciden.',
  })

export type NewPasswordValues = z.infer<typeof newPasswordSchema>
