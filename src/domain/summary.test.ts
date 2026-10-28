import { emptyState } from './state'
import { coworkers, monthSummary } from './summary'
import type { AppState } from './types'

function st(rows: Record<string, Record<string, string>>): AppState {
  const s = emptyState()
  for (const [id, row] of Object.entries(rows)) {
    s.persons[id] = { id, name: `${id}, ${id}`, note: '', puesto: id === 'B' ? '2' : '1', section: 'Rotatorio', candidate: true }
    s.grid[id] = row
  }
  return s
}

describe('resumen del mes y compañeros', () => {
  it('cuenta diurnos, noches, horas, libres y fines de semana', () => {
    // 2026-11-07 es sábado y 2026-11-08 domingo.
    const s = st({ YO: { '2026-11-06': 'L', '2026-11-07': '', '2026-11-08': 'N', '2026-11-09': 'D', '2026-11-10': 'V' } })
    expect(monthSummary(s, 'YO', '2026-11')).toEqual({ diurnos: 1, noches: 1, hours: 24, libres: 2, weekendDays: 2, known: 5, days: 30 })
  })

  it('compañeros con el mismo turno, ordenados por número', () => {
    const s = st({ YO: { '2026-11-02': 'N' }, B: { '2026-11-02': 'N' }, A: { '2026-11-02': 'N' }, C: { '2026-11-02': '' } })
    s.persons.A.puesto = '1'
    expect(coworkers(s, 'YO', '2026-11-02').map((p) => p.id)).toEqual(['A', 'B'])
    expect(coworkers(s, 'YO', '2026-11-03')).toEqual([])
  })
})
