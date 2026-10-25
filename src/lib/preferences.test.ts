import { describe, expect, it } from 'vitest'
import { defaultPreferences, isReportView, reportViews, toPreferences } from './preferences'

describe('toPreferences', () => {
  it('sin datos: los valores por defecto', () => {
    expect(toPreferences(null)).toEqual(defaultPreferences)
  })

  it('acepta valores válidos', () => {
    expect(toPreferences({ reportView: 'pace', spendAlerts: false, alertThreshold: 60 })).toEqual({
      reportView: 'pace',
      spendAlerts: false,
      alertThreshold: 60,
    })
  })

  it('valores desconocidos vuelven al defecto', () => {
    expect(toPreferences({ reportView: 'pie', spendAlerts: 'x', alertThreshold: 85 })).toEqual(
      defaultPreferences,
    )
  })

  it('las seis vistas tienen nombre y descripción', () => {
    expect(reportViews).toHaveLength(6)
    for (const view of reportViews) {
      expect(isReportView(view.id)).toBe(true)
      expect(view.name.length).toBeGreaterThan(0)
      expect(view.description.length).toBeGreaterThan(0)
    }
  })
})
