import { useId, useState } from 'react'
import { addDays, todayBogota } from '../../lib/dates'
import { Segmented } from '../ui/Segmented'
import { TextInput } from '../ui/Field'

type Choice = 'today' | 'yesterday' | 'other'

interface DateChipsProps {
  value: string
  onChange: (date: string) => void
  label?: string
  error?: string
}

/** Fecha en un toque: Hoy / Ayer, y el calendario solo si se pide "Otra fecha". */
export function DateChips({ value, onChange, label = '¿Cuándo?', error }: DateChipsProps) {
  const today = todayBogota()
  const yesterday = addDays(today, -1)
  const derived: Choice = value === today ? 'today' : value === yesterday ? 'yesterday' : 'other'
  const [picking, setPicking] = useState(derived === 'other')
  const errorId = useId()
  const choice: Choice = picking ? 'other' : derived

  return (
    <div className="flex flex-col gap-2">
      <Segmented
        label={label}
        value={choice}
        onChange={(next) => {
          setPicking(next === 'other')
          if (next === 'today') onChange(today)
          if (next === 'yesterday') onChange(yesterday)
        }}
        options={[
          { value: 'today', label: 'Hoy' },
          { value: 'yesterday', label: 'Ayer' },
          { value: 'other', label: 'Otra fecha' },
        ]}
      />
      {choice === 'other' && (
        <TextInput
          type="date"
          aria-label="Fecha"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  )
}
