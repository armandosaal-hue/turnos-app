import { recommend } from './engine'
import { emptyState, registerCambio, deleteCambio, analyzeImport, applyImport } from './state'
import type { AppState, Person } from './types'
import { violations } from './rules'
import { defaultLegend } from './legend'
import { defaultRules } from './rules'

// Días: 1 = 2026-03-01 … Se escribe cada calendario como lista de códigos
// separados por espacios; "_" = celda vacía (diurno 12 h).
const START = '2026-03-01'
function dateOf(i: number) {
  const d = new Date(Date.UTC(2026, 2, 1 + i))
  return d.toISOString().slice(0, 10)
}
function row(spec: string): Record<string, string> {
  const out: Record<string, string> = {}
  spec.trim().split(/\s+/).forEach((c, i) => (out[dateOf(i)] = c === '_' ? '' : c))
  return out
}
function person(id: string, candidate = true): Person {
  return { id, name: `${id}, ${id}`, note: '', puesto: '1', section: 'Rotatorio', candidate }
}
function state(rows: Record<string, string>, extra: Partial<AppState> = {}): AppState {
  const s = emptyState()
  for (const [id, spec] of Object.entries(rows)) {
    s.persons[id] = person(id)
    s.grid[id] = row(spec)
  }
  return { ...s, ...extra }
}
const day = (n: number) => dateOf(n - 1) // día n del mes (1-based)

describe('quitarme un día', () => {
  it('descarta a quien trabaja ese día y acepta a quien libra', () => {
    const s = state({
      YO: 'L L _ L L L',
      ANA: 'L L _ L L L',
      BEA: 'L L L L L L',
    })
    const r = recommend(s, 'YO', day(3))
    expect(r.type).toBe('quitar')
    expect(r.candidates.map((c) => c.personId)).toEqual(['BEA'])
    expect(r.discarded.find((d) => d.personId === 'ANA')?.reason).toMatch(/trabaja/)
  })

  it('descarta el D inmediatamente posterior a una N, pero no el segundo D', () => {
    const s = state({
      YO: 'L L L _ L L',
      ANA: 'L L N D L L', // día 4 es su descanso tras noche
      BEA: 'L N N D D L', // día 4 es el D tras N; día 5 es el segundo D
    })
    expect(recommend(s, 'YO', day(4)).discarded.map((d) => d.personId).sort()).toEqual(['ANA', 'BEA'])
    const s2 = state({ YO: 'L L L L _ L', BEA: 'L N N D D L' })
    expect(recommend(s2, 'YO', day(5)).candidates.map((c) => c.personId)).toEqual(['BEA'])
  })

  it('descarta 24 h seguidas: N y diurno al día siguiente', () => {
    const s = state({
      YO: 'L L N L L L',
      ANA: 'L L L _ L L', // haría N el 3 y diurno el 4
    })
    const r = recommend(s, 'YO', day(3))
    expect(r.candidates).toHaveLength(0)
    expect(r.discarded[0].reason).toMatch(/24 h seguidas/)
  })

  it('permite N → N', () => {
    const s = state({ YO: 'L L N L L L', ANA: 'L L L N D L' })
    expect(recommend(s, 'YO', day(3)).candidates.map((c) => c.personId)).toEqual(['ANA'])
  })

  it('trata los códigos sin definir como no disponibles', () => {
    const s = state({ YO: 'L _ L', ANA: 'L ZZ L' })
    expect(recommend(s, 'YO', day(2)).discarded[0].reason).toMatch(/no disponible/)
  })

  it('excluye a quien no es candidato (turno fijo)', () => {
    const s = state({ YO: 'L _ L', ANA: 'L L L' })
    s.persons.ANA.candidate = false
    expect(recommend(s, 'YO', day(2)).candidates).toHaveLength(0)
  })
})

describe('devoluciones', () => {
  it('propone días en que el compañero trabaja y yo libro, y descarta los que me dejan 24 h', () => {
    const s = state({
      //    1 2 3 4 5 6 7
      YO: '  L L _ N L L L',
      ANA: ' L L L L _ _ L',
    })
    const r = recommend(s, 'YO', day(3))
    const ana = r.candidates.find((c) => c.personId === 'ANA')!
    // Día 5: yo vengo de N el 4 → diurno el 5 serían 24 h. Día 6: válido.
    expect(ana.returns.map((x) => x.date)).toEqual([day(6)])
  })

  it('descarta la devolución que deja al compañero con 24 h seguidas', () => {
    // Me pongo a trabajar el 2 (diurno de ANA). Devolución: ANA cubre un diurno mío.
    // El 4 no vale: ANA viene de N el 3 (24 h seguidas). El 6 sí.
    const s = state({
      //    1 2 3 4 5 6
      YO: '  L L L _ L _',
      ANA: ' L _ N L L L',
    })
    const r = recommend(s, 'YO', day(2))
    expect(r.type).toBe('trabajar')
    expect(r.candidates[0].returns.map((x) => x.date)).toEqual([day(6)])
  })

  it('marca candidato sin devolución posible', () => {
    const s = state({ YO: 'L _ L', ANA: 'L L L' })
    const r = recommend(s, 'YO', day(2))
    expect(r.candidates[0].returns).toHaveLength(0)
  })

  it('ordena primero a quien tiene devoluciones', () => {
    const s = state({
      YO: ' L _ L L',
      ANA: 'L L L L',
      BEA: 'L L L _',
    })
    const r = recommend(s, 'YO', day(2))
    expect(r.candidates.map((c) => c.personId)).toEqual(['BEA', 'ANA'])
  })
})

describe('ponerme a trabajar', () => {
  it('busca a quien trabaja ese día y puede librarlo', () => {
    const s = state({
      YO: ' L L L L',
      ANA: 'L _ L L',
      BEA: 'L L L L',
    })
    const r = recommend(s, 'YO', day(2))
    expect(r.type).toBe('trabajar')
    expect(r.candidates.map((c) => c.personId)).toEqual(['ANA'])
  })

  it('no deja ponerme a trabajar en mi descanso tras noche', () => {
    const s = state({ YO: 'N D L', ANA: 'L _ L' })
    expect(recommend(s, 'YO', day(2)).error).toMatch(/descanso posterior/)
  })
})

describe('reglas', () => {
  it('detecta solape y horas seguidas', () => {
    const legend = defaultLegend()
    const rules = defaultRules()
    const v = violations({ [START]: '', '2026-03-02': '' }, legend, rules)
    expect(v).toHaveLength(0)
    const v2 = violations({ [START]: 'N', '2026-03-02': '' }, legend, rules)
    expect(v2.map((x) => x.key)[0]).toMatch(/^continuas/)
    const v3 = violations({ [START]: 'T', '2026-03-02': 'L' }, { ...legend }, rules)
    expect(v3).toHaveLength(0)
  })

  it('aplica secuencias prohibidas configuradas', () => {
    const rules = defaultRules()
    rules.forbiddenSequences.items = [{ from: 'N', to: 'M' }]
    const v = violations({ [START]: 'N', '2026-03-02': 'M' }, defaultLegend(), rules)
    expect(v.some((x) => x.key.startsWith('secuencia'))).toBe(true)
  })

  it('una regla desactivada no descarta', () => {
    const rules = defaultRules()
    rules.maxContinuousHours.enabled = false
    const s = state({ YO: 'L L N L', ANA: 'L L L _' }, { rules })
    expect(recommend(s, 'YO', day(3)).candidates.map((c) => c.personId)).toEqual(['ANA'])
  })
})

describe('cambios y versiones', () => {
  it('registra un cambio, lo aplica y lo deshace', () => {
    let s = state({ YO: 'L _ L', ANA: 'L L L' })
    s = registerCambio(s, 'YO', 'quitar', day(2), 'ANA')
    expect(s.grid.YO[day(2)]).toBe('L')
    expect(s.grid.ANA[day(2)]).toBe('')
    s = deleteCambio(s, s.cambios[0].id)
    expect(s.grid.YO[day(2)]).toBe('')
    expect(s.grid.ANA[day(2)]).toBe('L')
  })

  it('una nueva versión confirma los cambios que recoge y avisa de los demás', () => {
    let s = state({ YO: 'L _ L _', ANA: 'L L L L' })
    s = registerCambio(s, 'YO', 'quitar', day(2), 'ANA')
    s = registerCambio(s, 'YO', 'quitar', day(4), 'ANA')
    const [c4, c2] = s.cambios
    const parsed = {
      persons: { YO: person('YO'), ANA: person('ANA') },
      grid: { YO: row('L L L _'), ANA: row('L _ B L') }, // recoge el del día 2; el 3 cambia
      from: day(1),
      to: day(4),
      codes: {},
      warnings: [],
    }
    const a = analyzeImport(s, parsed)
    expect(a.confirmedCambios).toEqual([c2.id])
    expect(a.notReflected).toEqual([c4.id])
    const kinds = Object.fromEntries(a.diffs.map((d) => [`${d.personId}${d.date}`, d.kind]))
    expect(kinds[`ANA${day(3)}`]).toBe('nuevo')
    expect(kinds[`YO${day(4)}`]).toBe('cambio-pendiente')
    s = applyImport(s, parsed, a, 'v2.xlsx')
    expect(s.grid.ANA[day(3)]).toBe('B')
    expect(s.grid.YO[day(4)]).toBe('L') // se mantiene el cambio pendiente
    expect(s.cambios.find((c) => c.id === c2.id)?.status).toBe('confirmado')
    expect(s.cambios.find((c) => c.id === c4.id)?.notReflected).toBe(true)
  })
})

describe('encadenar turnos y no partir libres', () => {
  it('pone por delante a quien encadena que a quien le queda un turno suelto entre libres', () => {
    const s = state({
      //     1 2 3 4 5
      YO: '  L L _ L L',
      ANA: ' L L L L L', // un diurno el 3 le parte 5 libres
      BEA: ' L _ L L L', // un diurno el 3 encadena con el del 2
    })
    const r = recommend(s, 'YO', day(3))
    expect(r.candidates.map((c) => c.personId)).toEqual(['BEA', 'ANA'])
    expect(r.candidates[0].reasons.join(' ')).toMatch(/Encadena/)
    expect(r.candidates[1].reasons.join(' ')).toMatch(/parte 5 días libres en 2 \+ 2/)
  })

  it('cuenta el descanso tras noche como parte del bloque de trabajo', () => {
    const s = state({ YO: 'L L L _ L', ANA: 'L N D L L' })
    // ANA: N el 2, saliente el 3; un diurno el 4 encadena con el bloque N-D.
    expect(recommend(s, 'YO', day(4)).candidates[0].reasons.join(' ')).toMatch(/Encadena/)
  })

  it('se puede desactivar', () => {
    const rules = defaultRules()
    rules.preferChains = { enabled: false }
    const s = state({ YO: 'L L _ L L', ANA: 'L L L L L', BEA: 'L _ L L L' }, { rules })
    const r = recommend(s, 'YO', day(3))
    expect(r.candidates.every((c) => !c.reasons.join(' ').match(/Encadena|parte/))).toBe(true)
  })
})
