import { readingsToPlantilla, detectedMonth, ReadingSchema, type Reading } from './vision'
import { FIXED_BLANK } from './importer'

const fila = (nombre: string, celdas: string[], extra: Partial<Reading['filas'][number]> = {}) => ({
  puesto: '1',
  nombre,
  seccion: '',
  turno_fijo: false,
  celdas,
  dudosas: [],
  ...extra,
})

describe('lectura de imágenes', () => {
  it('une páginas troceadas por personas con el mes de la que lo tiene', () => {
    const p1: Reading = { mes: 11, anio: 2026, dias: [1, 2, 3], filas: [fila('PÉREZ GIL, ANA (RJ 50%)', ['N', 'D', ''])], avisos: [] }
    const p2: Reading = {
      mes: 0,
      anio: 0,
      dias: [1, 2, 3],
      filas: [fila('ROS SOL, EVA', ['', 'L', 'Lh'], { dudosas: [2] }), fila('MAÑANERA, LUZ', ['L', '', '12'], { seccion: 'MAÑANA', turno_fijo: true })],
      avisos: ['esquina cortada'],
    }
    const readings = [
      { fileName: 'a.jpg', reading: p1 },
      { fileName: 'b.jpg', reading: p2 },
    ]
    expect(detectedMonth(readings)).toEqual({ year: 2026, month: 11 })
    const r = readingsToPlantilla(readings, 2026, 11)
    expect(r.from).toBe('2026-11-01')
    expect(r.grid['PÉREZ GIL, ANA']).toEqual({ '2026-11-01': 'N', '2026-11-02': 'D', '2026-11-03': '' })
    expect(r.persons['PÉREZ GIL, ANA'].note).toBe('RJ 50%')
    expect(r.grid['ROS SOL, EVA']['2026-11-01']).toBe('')
    expect(r.doubtful['ROS SOL, EVA|2026-11-03']).toBe(true)
    expect(r.persons['MAÑANERA, LUZ'].candidate).toBe(false)
    expect(r.grid['MAÑANERA, LUZ']['2026-11-02']).toBe(FIXED_BLANK)
    expect(r.warnings).toEqual(['b.jpg: esquina cortada'])
  })

  it('une páginas troceadas por fechas y cambia de mes al reiniciar los días', () => {
    const a: Reading = { mes: 0, anio: 0, dias: [29, 30], filas: [fila('A, B', ['N', 'D'])], avisos: [] }
    const b: Reading = { mes: 0, anio: 0, dias: [30, 1, 2], filas: [fila('A, B', ['X', 'L', ''])], avisos: [] }
    const r = readingsToPlantilla(
      [
        { fileName: 'a', reading: a },
        { fileName: 'b', reading: b },
      ],
      2026,
      11,
    )
    expect(r.grid['A, B']).toEqual({ '2026-11-29': 'N', '2026-11-30': 'D', '2026-12-01': 'L', '2026-12-02': '' })
    // El 30 se leyó distinto en las dos imágenes: queda el primero y marcado.
    expect(r.doubtful['A, B|2026-11-30']).toBe(true)
    expect(r.warnings[0]).toMatch(/distinto en dos imágenes/)
  })

  it('avisa si una fila no tiene tantas celdas como días y marca las que faltan', () => {
    const a: Reading = { mes: 11, anio: 2026, dias: [1, 2, 3], filas: [fila('A, B', ['N', 'D'])], avisos: [] }
    const r = readingsToPlantilla([{ fileName: 'a', reading: a }], 2026, 11)
    expect(r.warnings[0]).toMatch(/2 celdas para 3 días/)
    expect(r.doubtful['A, B|2026-11-03']).toBe(true)
  })

  it('valida la respuesta de la API', () => {
    expect(() => ReadingSchema.parse({ mes: 1 })).toThrow()
  })
})
