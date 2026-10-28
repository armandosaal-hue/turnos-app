import { recommend } from './engine'
import { emptyState, registerCambio, deleteCambio, analyzeImport, applyImport, ensureMe, editCells, clearManual } from './state'
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

  it('evalúa la fecha de devolución que propongo y explica por qué no vale', () => {
    const s = state({
      //    1 2 3 4 5 6 7
      YO: '  L L _ N L L L',
      ANA: ' L L L L _ _ L',
      BEA: ' L L L L L L L',
    })
    const ok = recommend(s, 'YO', day(3), { preferredReturn: day(6) })
    const ana = ok.candidates.find((c) => c.personId === 'ANA')!
    expect(ana.preferred && 'option' in ana.preferred && ana.preferred.option.date).toBe(day(6))
    const bea = ok.candidates.find((c) => c.personId === 'BEA')!
    expect(bea.preferred && 'reason' in bea.preferred && bea.preferred.reason).toMatch(/no tiene turno/)
    const bad = recommend(s, 'YO', day(3), { preferredReturn: day(5) })
    const ana5 = bad.candidates.find((c) => c.personId === 'ANA')!
    expect(ana5.preferred && 'reason' in ana5.preferred && ana5.preferred.reason).toMatch(/a ti te deja 24 h/)
    expect(recommend(s, 'YO', day(3)).candidates[0].preferred).toBeUndefined()
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

describe('mis turnos a mano', () => {
  it('crea mi fila si no aparezco y la une con la plantilla cuando salgo, respetando lo manual', () => {
    let s = ensureMe(emptyState(), 'SAAL PÉREZ, ARMANDO')
    expect(s.meId).toBe('SAAL PÉREZ, ARMANDO')
    s = editCells(s, s.meId!, [day(1), day(2)], 'N')
    expect(s.grid[s.meId!]).toEqual({ [day(1)]: 'N', [day(2)]: 'N' })
    const parsed = {
      persons: { 'SAAL PÉREZ, ARMANDO': person('SAAL PÉREZ, ARMANDO') },
      grid: { 'SAAL PÉREZ, ARMANDO': row('N D L') },
      from: day(1),
      to: day(3),
      codes: {},
      warnings: [],
    }
    const a = analyzeImport(s, parsed)
    // Día 1 coincide (deja de ser manual); día 2 difiere y es manual (se mantiene); día 3 es nuevo.
    expect(a.diffs.map((d) => [d.date, d.kind, d.apply])).toEqual([[day(2), 'manual', false]])
    s = applyImport(s, parsed, a, 'v1')
    expect(s.grid[s.meId!]).toEqual({ [day(1)]: 'N', [day(2)]: 'N', [day(3)]: 'L' })
    expect(s.origins[s.meId!][day(1)]).toBeUndefined()
    // Volver a la plantilla en el día 2 deja el valor de la versión nueva.
    s = clearManual(s, s.meId!, [day(2)])
    expect(s.grid[s.meId!][day(2)]).toBe('D')
  })

  it('borrar lo manual vuelve al valor anterior o deja el día sin dato', () => {
    let s = state({ YO: 'L _ L' })
    s = editCells(s, 'YO', [day(2), day(5)], 'V')
    s = editCells(s, 'YO', [day(2)], 'B') // segunda edición: conserva el original
    s = clearManual(s, 'YO', [day(2), day(5)])
    expect(s.grid.YO[day(2)]).toBe('')
    expect(s.grid.YO[day(5)]).toBeUndefined()
    expect(s.origins.YO?.[day(2)]).toBeUndefined()
  })

  it('el motor usa mis turnos corregidos', () => {
    let s = state({ YO: 'L L L', ANA: 'L L L' })
    s = editCells(s, 'YO', [day(2)], 'N')
    expect(recommend(s, 'YO', day(2)).type).toBe('quitar')
  })
})

describe('cada archivo sustituye a lo anterior', () => {
  it('borra los meses y personas que no trae y conserva lo manual dentro de sus meses', () => {
    // Estado: marzo cargado (YO y ANA) y BEA, que no estará en el archivo nuevo.
    let s = state({ YO: 'L _ L', ANA: 'N D L', BEA: 'L L L' })
    s = editCells(s, 'YO', ['2026-04-02'], 'V') // mi día manual en abril
    s = editCells(s, 'YO', ['2026-05-10'], 'B') // fuera de los meses del archivo nuevo
    const parsed = {
      persons: { ANA: person('ANA'), CARLA: person('CARLA') },
      grid: {
        ANA: { '2026-04-01': 'N', '2026-04-02': 'D' },
        CARLA: { '2026-04-01': 'L', '2026-04-02': '' },
      },
      from: '2026-04-01',
      to: '2026-04-02',
      codes: {},
      warnings: [],
    }
    s = { ...s, meId: 'YO' }
    const a = analyzeImport(s, parsed)
    expect(a.removedMonths).toEqual(['2026-03', '2026-05'])
    expect(a.removedPersons).toBe(1) // BEA (YO soy yo y no cuenta)
    s = applyImport(s, parsed, a, 'abril.xlsx')
    expect(Object.keys(s.persons).sort()).toEqual(['ANA', 'CARLA', 'YO'])
    expect(s.grid.ANA).toEqual({ '2026-04-01': 'N', '2026-04-02': 'D' })
    expect(s.grid.YO).toEqual({ '2026-04-02': 'V' }) // marzo y mayo borrados; el manual de abril se queda
    expect(s.origins.YO['2026-04-02']).toMatchObject({ origin: 'manual' })
    expect(s.grid.BEA).toBeUndefined()
  })
})
