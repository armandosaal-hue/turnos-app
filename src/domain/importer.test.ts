import { parsePlantilla, parseCsv, FIXED_BLANK, mergeParsed, monthsSummary } from './importer'

const header = (n: number, start = 1) => Array.from({ length: n }, (_, i) => ((start + i - 1) % 31) + 1)

describe('importador', () => {
  // Formato del Excel de la unidad: mes letra a letra, día, letra del día, personas.
  const rows = [
    [null, null, 'M', 'A', 'R', 'Z', 'O'],
    [null, '2026', 1, 2, '3', 4, 5],
    [null, null, 'D', 'L', 'M', 'X', 'J'],
    [1, 'PÉREZ GIL, ANA (RJ 50%)', 'L', null, 'N', 'D', 'x'],
    ['1.1', 'ROS SOL, EVA', 'x', 'x', 'L', 'L', null],
    [2, 'PÉREZ GIL, ANA', 'x', 'x', 'x', 'x', 'B'],
    [null, null, 1, 2, '3', null, null],
    [null, 'ENFERMERAS', 'D', 'L', 'M', null, null],
    [null, 'MAÑANA', null, null, null, null, null],
    [101, 'MAÑANERA, LUZ', 'M', 'M', null, null, null],
    [null, 'NOCHES A', null, null, null, null, null],
    [102, 'NOCTURNA, SOL', 'N', null, 'N', null, null],
  ]

  it('lee fechas, personas, celdas vacías y bloques', () => {
    const p = parsePlantilla(rows)
    expect(p.from).toBe('2026-03-01')
    expect(p.to).toBe('2026-03-05')
    expect(p.warnings).toEqual([])
    const ana = p.grid['PÉREZ GIL, ANA']
    expect(ana).toEqual({ '2026-03-01': 'L', '2026-03-02': '', '2026-03-03': 'N', '2026-03-04': 'D', '2026-03-05': 'B' })
    expect(p.persons['PÉREZ GIL, ANA'].note).toBe('RJ 50%')
    expect(p.grid['ROS SOL, EVA']['2026-03-05']).toBe('')
    // Bloque fijo: solo días 1–3; mañana fija no es candidata; personal fijo no candidato; vacío en turno fijo sin definir.
    expect(Object.keys(p.grid['MAÑANERA, LUZ'])).toHaveLength(3)
    expect(p.persons['MAÑANERA, LUZ'].candidate).toBe(false)
    expect(p.persons['NOCTURNA, SOL'].candidate).toBe(false)
    expect(p.persons['ROS SOL, EVA'].candidate).toBe(true)
    expect(p.grid['NOCTURNA, SOL']['2026-03-02']).toBe(FIXED_BLANK)
    expect(p.grid['MAÑANERA, LUZ']['2026-03-03']).toBe(FIXED_BLANK)
  })

  it('une filas repetidas de la misma persona y avisa de conflictos', () => {
    // La primera fila de Ana tiene x el día 5 y la segunda B: se queda B.
    expect(parsePlantilla(rows).grid['PÉREZ GIL, ANA']['2026-03-05']).toBe('B')
    const r2 = rows.map((r) => [...r])
    r2[5][3] = 'V'
    expect(parsePlantilla(r2).warnings[0]).toMatch(/valores distintos/)
  })

  it('cambia de mes al reiniciar la numeración y avisa si el día de la semana no cuadra', () => {
    const days = header(35, 1)
    const p = parsePlantilla([
      [null, null, 'E', 'N', 'E', 'R', 'O'],
      [null, '2026', ...days],
      [null, null, ...days.map(() => 'L')],
      [1, 'A, B', ...days.map(() => 'L')],
    ])
    expect(p.to).toBe('2026-02-04')
    expect(p.warnings[0]).toMatch(/no coinciden/)
  })

  it('lee CSV con punto y coma', () => {
    const r = parseCsv('a;b\n"x;y";2')
    expect(r).toEqual([['a', 'b'], ['x;y', '2']])
  })
})

describe('varios meses en un archivo', () => {
  const oct = [
    [null, null, 'O', 'C', 'T', 'U', 'B', 'R', 'E'],
    [null, '2026', 1, 2, 3],
    [null, null, 'J', 'V', 'S'],
    [1, 'A, ANA', 'N', 'D', 'L'],
    [2, 'MAYO GIL, EVA', '', 'L', 'N'],
    [null, null, 1, 2, 3],
    [null, 'ENFERMERAS', 'J', 'V', 'S'],
    [null, 'MAÑANA'],
    [101, 'M, LUZ', 'M', 'M', ''],
  ]
  const nov = [
    [null, null, 'N', 'O', 'V', 'I', 'E', 'M', 'B', 'R', 'E'],
    [null, null, 1, 2, 3],
    [null, null, 'D', 'L', 'M'],
    [1, 'A, ANA', 'L', '', 'N'],
    [2, 'MAYO GIL, EVA', 'N', 'D', 'L'],
  ]

  it('lee noviembre debajo de octubre con sus propias fechas y como rotatorio', () => {
    const p = parsePlantilla([...oct, ...nov])
    expect(p.from).toBe('2026-10-01')
    expect(p.to).toBe('2026-11-03')
    expect(p.warnings).toEqual([])
    expect(p.grid['A, ANA']).toEqual({
      '2026-10-01': 'N', '2026-10-02': 'D', '2026-10-03': 'L',
      '2026-11-01': 'L', '2026-11-02': '', '2026-11-03': 'N',
    })
    expect(p.persons['A, ANA'].candidate).toBe(true)
    // El bloque de mañana de octubre sigue siendo turno fijo.
    expect(p.persons['M, LUZ'].candidate).toBe(false)
    expect(monthsSummary(p)).toEqual([
      { month: '2026-10', persons: 3 },
      { month: '2026-11', persons: 2 },
    ])
    // Fila del Excel (contando desde 1) de cada persona en cada mes.
    expect(p.persons['A, ANA'].rows).toEqual({ '2026-10': 4, '2026-11': 13 })
    expect(p.persons['M, LUZ'].rows).toEqual({ '2026-10': 9 })
  })

  it('un mes con nombre en una celda ("Noviembre 2026") y paso de diciembre a enero', () => {
    const dic = [[null, 'DICIEMBRE 2026'], [null, null, 1, 2], [null, null, 'M', 'X'], [1, 'A, ANA', 'N', 'D']]
    const ene = [[null, 'Enero'], [null, null, 1, 2], [null, null, 'V', 'S'], [1, 'A, ANA', 'L', '']]
    const p = parsePlantilla([...dic, ...ene])
    expect(p.grid['A, ANA']).toEqual({ '2026-12-01': 'N', '2026-12-02': 'D', '2027-01-01': 'L', '2027-01-02': '' })
    expect(p.warnings).toEqual([])
  })

  it('une meses que vienen en pestañas distintas', () => {
    const a = parsePlantilla(oct)
    const b = parsePlantilla([[null, '2026', ...nov[0].slice(2)], ...nov.slice(1)].map((r, i) => (i === 0 ? [null, null, ...nov[0].slice(2)] : r)).map((r, i) => (i === 1 ? [null, '2026', 1, 2, 3] : r)))
    const m = mergeParsed([a, b])
    expect(Object.keys(m.grid['A, ANA'])).toHaveLength(6)
    expect(m.persons['MAYO GIL, EVA'].rows).toEqual({ '2026-10': 5, '2026-11': 5 })
    expect(m.to).toBe('2026-11-03')
  })
})

import { defaultDate } from './dates'
describe('fecha inicial', () => {
  const d = ['2026-01-05', '2026-10-01', '2026-11-30']
  it('hoy, la siguiente cargada o la última', () => {
    expect(defaultDate([...d, '2026-10-27'].sort(), '2026-10-27')).toBe('2026-10-27')
    expect(defaultDate(d, '2026-06-01')).toBe('2026-10-01')
    expect(defaultDate(d, '2027-01-01')).toBe('2026-11-30')
    expect(defaultDate(['2026-01', '2026-10'], '2026-10')).toBe('2026-10')
  })
})

import { parseWorkbook, monthYearFromName } from './importer'
describe('pestañas', () => {
  const oct = [
    [null, null, 'O', 'C', 'T', 'U', 'B', 'R', 'E'],
    [null, '2026', 1, 2, 3],
    [null, null, 'J', 'V', 'S'],
    [1, 'A, ANA', 'N', 'D', 'L'],
  ]
  it('noviembre en otra pestaña sin año ni mes en la hoja: usa el nombre de la pestaña y el año anterior', () => {
    const nov = [[null, null, 1, 2, 3], [null, null, 'D', 'L', 'M'], [1, 'A, ANA', 'L', '', 'N']]
    const p = parseWorkbook([
      { sheet: 'OCTUBRE', data: oct },
      { sheet: 'NOVIEMBRE', data: nov },
      { sheet: 'Leyenda', data: [['L', 'Libre']] },
    ])
    expect(p.grid['A, ANA']['2026-11-03']).toBe('N')
    expect(p.warnings.some((w) => w.includes('No se ha cargado'))).toBe(false)
  })
  it('noviembre con el mes letra a letra desplazado respecto al día 1', () => {
    const nov = [[null, null, null, 'N', 'O', 'V', 'I', 'E', 'M', 'B', 'R', 'E'], [null, null, 1, 2, 3], [1, 'A, ANA', 'L', '', 'N']]
    const p = parseWorkbook([
      { sheet: 'Hoja1', data: oct },
      { sheet: 'Hoja2', data: nov },
    ])
    expect(p.grid['A, ANA']['2026-11-01']).toBe('L')
  })
  it('avisa de la pestaña que no puede leer', () => {
    const raro = [[null, null, 1, 2, 3], [1, 'A, ANA', 'L', '', 'N']]
    const p = parseWorkbook([
      { sheet: 'OCTUBRE', data: oct },
      { sheet: 'Hoja 2', data: raro },
    ])
    expect(p.warnings[0]).toMatch(/No se ha cargado. Pestaña "Hoja 2": No encuentro el nombre del mes/)
  })
  it('nombres de pestaña abreviados', () => {
    expect(monthYearFromName('Nov 26')).toEqual({ month: 11, year: 2026 })
    expect(monthYearFromName('SEPT 2026')).toEqual({ month: 9, year: 2026 })
    expect(monthYearFromName('Plantilla diciembre')).toEqual({ month: 12, year: null })
    expect(monthYearFromName('Hoja1')).toEqual({ month: null, year: null })
  })
})

describe('pestaña que empieza con días del mes anterior', () => {
  it('usa el mes escrito encima del día 1, no el del mes anterior', () => {
    // 29 y 30 de octubre, luego noviembre. "OCT" encima del 29, "NOVIEMBRE" encima del 1.
    const nov = [
      [null, null, 'O', 'C', 'T', 'N', 'O', 'V', 'I', 'E', 'M', 'B', 'R', 'E'],
      [null, '2026', 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [null, null, 'J', 'V', 'S', 'D', 'L', 'M', 'X', 'J', 'V', 'S', 'D', 'L'],
      [1, 'A, ANA', 'x', 'x', 'x', 'N', 'D', 'L', '', 'L', 'L', 'N', 'D', 'L'],
    ]
    const p = parseWorkbook([{ sheet: 'NOVIEMBRE', data: nov }])
    expect(p.from).toBe('2026-11-01')
    expect(p.grid['A, ANA']['2026-11-01']).toBe('N')
    expect(p.warnings.some((w) => w.includes('No se ha cargado'))).toBe(false)
  })

  it('si el rótulo del mes no cuadra con la fila de días de la semana, usa el nombre de la pestaña', () => {
    const days = Array.from({ length: 30 }, (_, i) => i + 1)
    const L = 'DLMXJVS'
    const nov = [
      [null, 'SEPTIEMBRE'],
      [null, '2026', ...days],
      [null, null, ...days.map((d) => L[new Date(Date.UTC(2026, 10, d)).getUTCDay()])],
      [1, 'A, ANA', ...days.map(() => 'L')],
    ]
    const p = parseWorkbook([{ sheet: 'NOVIEMBRE', data: nov }])
    expect(p.from).toBe('2026-11-01')
    expect(p.to).toBe('2026-11-30')
  })
})

describe('día repetido en dos pestañas', () => {
  it('manda la pestaña con el mes completo', () => {
    const base = { from: '', to: '', codes: {}, warnings: [] }
    const anual = { ...base, persons: { A: { id: 'A', name: 'A', note: '', puesto: '1', section: 'Rotatorio', candidate: true } }, grid: { A: { '2026-10-31': 'L', '2026-11-01': 'L' } } }
    const nov = { ...base, persons: anual.persons, grid: { A: { '2026-11-01': 'N', '2026-11-02': 'D', '2026-11-03': 'L' } } }
    const m = mergeParsed([anual, nov])
    expect(m.grid.A['2026-11-01']).toBe('N')
    expect(m.grid.A['2026-10-31']).toBe('L')
  })
})

describe('columnas de un mes borradas', () => {
  it('30 de septiembre seguido de 30 y 31 de octubre sin rótulo: usa la fila de días de la semana', () => {
    // Como la pestaña NOVIEMBRE real: ... 29 M, 30 X (sept), 30 V, 31 S (oct), 1 D (nov) ...
    const rows = [
      [null, null, 'S', 'E', 'P', 'T', 'I', 'E', 'M', 'B', 'R', 'E', null, null, null, 'N', 'O', 'V'],
      [null, '2026', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 29, 30, 30, 31, 1, 2],
      [null, null, 'M', 'X', 'J', 'V', 'S', 'D', 'L', 'M', 'X', 'J', 'M', 'X', 'V', 'S', 'D', 'L'],
      [1, 'A, ANA', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', '', 'N', 'D'],
    ]
    const p = parsePlantilla(rows)
    expect(p.warnings.filter((w) => !w.includes('celdas vacías'))).toEqual([])
    expect(p.grid['A, ANA']['2026-09-30']).toBe('L')
    expect(p.grid['A, ANA']['2026-10-31']).toBe('')
    expect(p.grid['A, ANA']['2026-11-01']).toBe('N')
    expect(p.grid['A, ANA']['2026-11-02']).toBe('D')
  })
})
