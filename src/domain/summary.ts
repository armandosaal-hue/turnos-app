import { addDays, daysInMonth, isoDate, isWeekend, minutesOf } from './dates'
import { visualKind } from './legend'
import { byPuesto } from './puesto'
import type { AppState, Person } from './types'

export interface MonthSummary {
  diurnos: number
  noches: number
  hours: number
  libres: number // libres y descansos
  weekendDays: number // sábados y domingos con diurno o noche
  known: number // días del mes con dato
  days: number
}

// Horas de un turno según la leyenda (la noche termina al día siguiente).
function shiftHours(state: AppState, code: string): number {
  const c = state.legend[code]
  if (!c?.start || !c?.end) return 12
  let m = minutesOf(c.end) - minutesOf(c.start)
  if (m <= 0) m += 24 * 60
  return m / 60
}

export function monthSummary(state: AppState, meId: string, month: string): MonthSummary {
  const [y, m] = month.split('-').map(Number)
  const row = state.grid[meId] ?? {}
  const { nightCode, restCode } = state.rules.restAfterNight
  const out: MonthSummary = { diurnos: 0, noches: 0, hours: 0, libres: 0, weekendDays: 0, known: 0, days: daysInMonth(y, m) }
  for (let d = 1; d <= out.days; d++) {
    const date = isoDate(y, m, d)
    const code = row[date]
    if (code === undefined) continue
    out.known++
    const vk = visualKind(state.legend, code, row[addDays(date, -1)], nightCode, restCode)
    if (vk === 'diurno' || vk === 'noche') {
      if (vk === 'diurno') out.diurnos++
      else out.noches++
      out.hours += shiftHours(state, code)
      if (isWeekend(date)) out.weekendDays++
    } else if (vk === 'libre' || vk === 'saliente') out.libres++
  }
  return out
}

// Compañeros con el mismo turno de 12 h ese día según la plantilla, ordenados por número.
export function coworkers(state: AppState, meId: string, date: string): Person[] {
  const code = state.grid[meId]?.[date]
  if (code === undefined) return []
  const vk = visualKind(state.legend, code)
  if (vk !== 'diurno' && vk !== 'noche') return []
  return Object.values(state.persons)
    .filter((p) => p.id !== meId && state.grid[p.id]?.[date] === code)
    .sort(byPuesto)
}
