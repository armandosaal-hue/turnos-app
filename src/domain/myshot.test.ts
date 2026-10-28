import { defaultLegend } from './legend'
import { myCodes, nearestYear, parsePastedMyShots, shotsToMonths } from './myshot'

const legend = defaultLegend()

describe('captura de mi app de turnos', () => {
  it('pone D tras cada noche, L en el resto y respeta N → N', () => {
    const months = shotsToMonths(
      [
        {
          mes: 11,
          anio: 2026,
          dias: [
            { dia: 2, turno: 'diurno', texto: 'Día', dudoso: false },
            { dia: 3, turno: 'noche', texto: 'N', dudoso: false },
            { dia: 4, turno: 'noche', texto: 'N', dudoso: false },
            { dia: 7, turno: 'noche', texto: 'N', dudoso: false },
            { dia: 8, turno: 'diurno', texto: 'Día', dudoso: true },
            { dia: 9, turno: 'otro', texto: 'Vac', dudoso: false },
          ],
          criterio: '',
          avisos: [],
        },
      ],
      { year: 2026, month: 1 },
    )
    const c = myCodes(months, {}, legend)
    expect(Object.keys(c)).toHaveLength(30)
    expect(c['2026-11-01']).toBe('L')
    expect(c['2026-11-02']).toBe('')
    expect(c['2026-11-03']).toBe('N')
    expect(c['2026-11-04']).toBe('N')
    expect(c['2026-11-05']).toBe('D')
    expect(c['2026-11-06']).toBe('L')
    expect(c['2026-11-08']).toBe('') // diurno tras noche: no se pone D (lo avisará la regla de 24 h)
    expect(c['2026-11-09']).toBe('L')
    expect(months[0].doubtful).toEqual([8])
  })

  it('si el mes acaba en noche, pone el D el día 1 del mes siguiente solo si está libre', () => {
    const months = shotsToMonths([{ mes: 11, anio: 2026, dias: [{ dia: 30, turno: 'noche', texto: 'N', dudoso: false }], criterio: '', avisos: [] }], {
      year: 2026,
      month: 11,
    })
    expect(myCodes(months, { '2026-12-01': 'L' }, legend)['2026-12-01']).toBe('D')
    expect(myCodes(months, { '2026-12-01': 'N' }, legend)['2026-12-01']).toBeUndefined()
  })

  it('lee la respuesta pegada del chat y usa el mes indicado si la captura no lo trae', () => {
    const shots = parsePastedMyShots('Aquí tienes:\n```json\n[{"mes":0,"anio":0,"dias":[{"dia":"5","turno":"Noche","texto":"N"}],"criterio":"luna = noche"}]\n```')
    const months = shotsToMonths(shots, { year: 2026, month: 12 })
    expect(months[0]).toMatchObject({ year: 2026, month: 12, shifts: { 5: 'noche' } })
    expect(() => parsePastedMyShots('hola')).toThrow(/No encuentro/)
  })

  it('captura de ejemplo de noviembre: D tras cada noche, libre el resto y año deducido', () => {
    const d = (dia: number, turno: 'diurno' | 'noche' | 'otro') => ({ dia, turno, texto: '', dudoso: false })
    const shot = {
      mes: 11,
      anio: 0,
      dias: [d(2, 'noche'), d(4, 'diurno'), d(6, 'otro'), d(7, 'diurno'), d(8, 'noche'), d(13, 'diurno'), d(14, 'noche'), d(19, 'diurno'), d(20, 'noche'), d(21, 'noche'), d(25, 'diurno'), d(26, 'noche')],
      criterio: '',
      avisos: [],
    }
    const months = shotsToMonths([shot], { year: 2026, month: 10 })
    expect(months[0].year).toBe(2026)
    const c = myCodes(months, {}, legend)
    const pick = (code: string) => Object.keys(c).filter((k) => c[k] === code).map((k) => Number(k.slice(8)))
    expect(pick('')).toEqual([4, 7, 13, 19, 25])
    expect(pick('N')).toEqual([2, 8, 14, 20, 21, 26])
    expect(pick('D')).toEqual([3, 9, 15, 22, 27])
    expect(pick('L')).toHaveLength(30 - 16)
    expect(nearestYear(1, { year: 2026, month: 12 })).toBe(2027)
  })
})
