import { daysInMonth, isoDate, MONTHS, weekday, WEEKDAY_LETTER } from './dates'
import { BLANK, type Grid, type Person } from './types'

export type Cell = string | number | boolean | Date | null | undefined

export interface ParsedPlantilla {
  persons: Record<string, Person>
  grid: Grid
  from: string
  to: string
  codes: Record<string, number>
  warnings: string[]
}

// Valor que el Excel usa para "este día no ocupa este puesto" cuando una persona
// aparece en dos filas (suplencias).
const PLACEHOLDER = 'x'

// En los bloques de turno fijo la celda vacía no es un diurno de 12 h y su
// significado no está confirmado: se guarda con este código (no disponible).
export const FIXED_BLANK = '∅'

function text(v: Cell): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v).trim()
}

function dayNumber(v: Cell): number | null {
  const t = text(v)
  if (!/^\d{1,2}(\.0)?$/.test(t)) return null
  const n = Number(t)
  return n >= 1 && n <= 31 ? n : null
}

export function personKey(rawName: string): { id: string; name: string; note: string } {
  const note = (rawName.match(/\(([^)]*)\)/g) ?? []).map((s) => s.slice(1, -1).trim()).join(' · ')
  const name = rawName.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  return { id: name.toUpperCase(), name, note }
}

export function parsePlantilla(rows: Cell[][]): ParsedPlantilla {
  const warnings: string[] = []

  // 1. Fila de cabecera: la primera con 1 y 2 en columnas consecutivas.
  let h = -1
  let c0 = -1
  for (let r = 0; r < Math.min(rows.length, 15) && h < 0; r++) {
    const row = rows[r] ?? []
    for (let c = 0; c < row.length - 1; c++) {
      if (dayNumber(row[c]) === 1 && dayNumber(row[c + 1]) === 2) {
        h = r
        c0 = c
        break
      }
    }
  }
  if (h < 0) throw new Error('No encuentro la fila con los días del mes (1, 2, 3…).')

  // 2. Año y mes inicial.
  let year: number | null = null
  for (let r = 0; r <= h && year === null; r++) {
    for (const v of rows[r] ?? []) {
      const t = text(v)
      if (/^20\d\d(\.0)?$/.test(t)) {
        year = Number(t)
        break
      }
    }
  }
  if (year === null) throw new Error('No encuentro el año en la cabecera.')

  let month: number | null = null
  if (h > 0) {
    let word = ''
    const above = rows[h - 1] ?? []
    for (let c = c0; c < above.length && /^[A-ZÁÉÍÓÚÑ]$/i.test(text(above[c])); c++) word += text(above[c]).toUpperCase()
    const idx = MONTHS.indexOf(word)
    if (idx >= 0) month = idx + 1
  }
  if (month === null) throw new Error('No encuentro el nombre del mes encima del día 1.')

  // 3. Columna -> fecha.
  const colDate: Record<number, string> = {}
  const header = rows[h]
  let prev = 0
  let y = year
  let m = month
  for (let c = c0; c < header.length; c++) {
    const d = dayNumber(header[c])
    if (d === null) break
    if (d < prev) {
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }
    if (d > daysInMonth(y, m)) throw new Error(`Día ${d} no existe en ${MONTHS[m - 1].toLowerCase()} de ${y}.`)
    colDate[c] = isoDate(y, m, d)
    prev = d
  }
  const cols = Object.keys(colDate).map(Number)
  const from = colDate[cols[0]]
  const to = colDate[cols[cols.length - 1]]

  // 4. Comprobación con la fila de días de la semana.
  const wrow = rows[h + 1] ?? []
  let mismatches = 0
  for (const c of cols) {
    const t = text(wrow[c]).toUpperCase()
    if (t && t !== WEEKDAY_LETTER[weekday(colDate[c])]) mismatches++
  }
  if (mismatches) warnings.push(`${mismatches} días no coinciden con la letra del día de la semana. Revisa el mes y el año.`)

  // 5. Filas de personas, por bloques y secciones.
  const persons: Record<string, Person> = {}
  const grid: Grid = {}
  const codes: Record<string, number> = {}
  let blockCols = cols
  let section = 'Rotatorio'
  let fixedBlock = false
  let conflicts = 0

  for (let r = h + 2; r < rows.length; r++) {
    const row = rows[r] ?? []
    const a = text(row[0])
    const b = text(row[1])
    const dataCells = cols.filter((c) => text(row[c]) !== '')

    if (!a) {
      // Nueva cabecera de bloque: solo valen las columnas que tienen día.
      if (dataCells.length && dayNumber(row[c0]) === 1) {
        blockCols = cols.filter((c) => dayNumber(row[c]) !== null)
        fixedBlock = true
        continue
      }
      if (b && !/^\d+$/.test(b)) section = b
      continue
    }
    if (!b) continue

    const { id, name, note } = personKey(b)
    const target = (grid[id] ??= {})
    const existing = persons[id]
    if (!existing) {
      // El personal de turno fijo (mañana y noches) no entra como candidato.
      persons[id] = { id, name, note, puesto: a, section, candidate: !fixedBlock }
    } else if (note && !existing.note.includes(note)) {
      existing.note = [existing.note, note].filter(Boolean).join(' · ')
    }

    for (const c of blockCols) {
      let code = text(row[c])
      if (code === BLANK && fixedBlock) code = FIXED_BLANK
      const date = colDate[c]
      const cur = target[date]
      if (cur === undefined || cur === PLACEHOLDER) target[date] = code
      else if (code !== PLACEHOLDER && code !== cur) conflicts++
    }
  }
  if (conflicts) warnings.push(`${conflicts} días con valores distintos en filas repetidas de una misma persona; se ha mantenido el de la primera fila.`)

  for (const row of Object.values(grid)) {
    for (const code of Object.values(row)) codes[code] = (codes[code] ?? 0) + 1
  }
  if (!Object.keys(persons).length) throw new Error('No encuentro filas de personas (número en la columna A y nombre en la B).')
  if (codes[BLANK] === undefined) warnings.push('No hay celdas vacías: revisa si el diurno aparece con otro código.')

  return { persons, grid, from, to, codes, warnings }
}

// CSV sencillo (separador ; o ,) a filas.
export function parseCsv(textContent: string): Cell[][] {
  const lines = textContent.replace(/\r/g, '').split('\n')
  const first = lines[0] ?? ''
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ';' : ','
  return lines.map((line) => {
    const out: string[] = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"'
          i++
        } else quoted = !quoted
      } else if (ch === sep && !quoted) {
        out.push(cur)
        cur = ''
      } else cur += ch
    }
    out.push(cur)
    return out.map((v) => (v.trim() === '' ? null : v))
  })
}
