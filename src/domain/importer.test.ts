import { parsePlantilla, parseCsv, FIXED_BLANK } from './importer'

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
