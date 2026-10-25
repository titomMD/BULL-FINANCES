import { useEffect, useState } from 'react'
import {
  cacheRate,
  fetchDollarRate,
  isFresh,
  readCachedRate,
  REFRESH_MS,
  type DollarRate,
} from '../lib/fx'

/** Dólar del día: usa lo guardado si está fresco y se actualiza solo cada pocas horas. */
export function useDollar(): { rate: DollarRate | null; loading: boolean; refresh: () => void } {
  const [rate, setRate] = useState<DollarRate | null>(() => readCachedRate())
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const cached = readCachedRate()
    if (tick === 0 && cached && isFresh(cached)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- indica que la consulta empezó
    setLoading(true)
    void fetchDollarRate().then((fresh) => {
      if (cancelled) return
      if (fresh) {
        cacheRate(fresh)
        setRate(fresh)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [tick])

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  return { rate, loading, refresh: () => setTick((value) => value + 1) }
}
