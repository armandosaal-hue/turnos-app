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

// Columna del día 1 en una fila de días (1 y 2 seguidos), o -1.
function headerCol(row: Cell[]): number {
  for (let c = 0; c < row.length - 1; c++) {
    if (dayNumber(row[c]) === 1 && dayNumber(row[c + 1]) === 2) return c
  }
  return -1
}

// Mes escrito cerca de una fila de días: letra a letra sobre el día 1 ("N O V…")
// o como palabra en alguna celda ("NOVIEMBRE", "Noviembre 2026").
function monthNear(rows: Cell[][], h: number, c0: number): number | null {
  for (const r of [h - 1, h - 2, h]) {
    const row = rows[r]
    if (!row) continue
    let word = ''
    for (let c = c0; c < row.length && /^[A-ZÁÉÍÓÚÑ]$/i.test(text(row[c])); c++) word += text(row[c]).toUpperCase()
    let idx = MONTHS.indexOf(word)
    if (idx >= 0) return idx + 1
    for (const v of row) {
      const t = text(v).toUpperCase()
      // Solo celdas que son el mes (con año opcional), para no confundir apellidos como "Mayo".
      idx = MONTHS.findIndex((m) => new RegExp(`^${m}(\\s+(DE\\s+)?20\\d\\d)?$`).test(t))
      if (idx >= 0) return idx + 1
    }
  }
  return null
}

function yearNear(rows: Cell[][], h: number): number | null {
  for (const r of [h, h - 1, h - 2]) {
    for (const v of rows[r] ?? []) {
      const m = text(v).match(/(^|\D)(20\d\d)(\.0)?(\D|$)/)
      if (m) return Number(m[2])
    }
  }
  return null
}

// Columna -> fecha a partir de una fila de días. Si la numeración vuelve a empezar, pasa de mes.
function columnDates(header: Cell[], c0: number, year: number, month: number): Record<number, string> {
  const colDate: Record<number, string> = {}
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
  return colDate
}

export function parsePlantilla(rows: Cell[][]): ParsedPlantilla {
  const warnings: string[] = []

  // 1. Primera fila de días.
  let h = -1
  let c0 = -1
  for (let r = 0; r < Math.min(rows.length, 15) && h < 0; r++) {
    c0 = headerCol(rows[r] ?? [])
    if (c0 >= 0) h = r
  }
  if (h < 0) throw new Error('No encuentro la fila con los días del mes (1, 2, 3…).')

  const year = yearNear(rows, h)
  if (year === null) throw new Error('No encuentro el año en la cabecera.')
  const month = monthNear(rows, h, c0)
  if (month === null) throw new Error('No encuentro el nombre del mes encima del día 1.')

  let colDate = columnDates(rows[h], c0, year, month)
  let cols = Object.keys(colDate).map(Number)

  // Comprueba la fila de días de la semana de un bloque.
  let mismatches = 0
  const checkWeekdays = (hr: number) => {
    const wrow = rows[hr + 1] ?? []
    for (const c of cols) {
      const t = text(wrow[c]).toUpperCase()
      if (t && t !== WEEKDAY_LETTER[weekday(colDate[c])]) mismatches++
    }
  }
  checkWeekdays(h)

  // 2. Filas de personas, por bloques y secciones. Una nueva fila de días con nombre
  // de mes empieza otro mes; sin nombre de mes es el bloque de turno fijo del mismo mes.
  const persons: Record<string, Person> = {}
  const grid: Grid = {}
  const codes: Record<string, number> = {}
  let blockCols = cols
  let section = 'Rotatorio'
  let fixedBlock = false
  let conflicts = 0
  let lastDate = colDate[cols[cols.length - 1]]

  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r] ?? []
    const a = text(row[0])
    const b = text(row[1])

    if (!a) {
      const hc = headerCol(row)
      if (hc >= 0) {
        const nm = monthNear(rows, r, hc)
        if (nm !== null) {
          let ny = yearNear(rows, r)
          if (ny === null) {
            const [ly, lm] = lastDate.split('-').map(Number)
            ny = nm < lm ? ly + 1 : ly
          }
          colDate = columnDates(row, hc, ny, nm)
          cols = Object.keys(colDate).map(Number)
          blockCols = cols
          lastDate = colDate[cols[cols.length - 1]]
          section = 'Rotatorio'
          fixedBlock = false
          checkWeekdays(r)
        } else {
          blockCols = cols.filter((c) => dayNumber(row[c]) !== null)
          fixedBlock = true
        }
        continue
      }
      if (b && !/^\d+$/.test(b) && !headerLike(row, cols)) section = b
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
  if (mismatches) warnings.push(`${mismatches} días no coinciden con la letra del día de la semana. Revisa el mes y el año.`)
  if (conflicts) warnings.push(`${conflicts} días con valores distintos en filas repetidas de una misma persona; se ha mantenido el de la primera fila.`)

  for (const row of Object.values(grid)) {
    for (const code of Object.values(row)) codes[code] = (codes[code] ?? 0) + 1
  }
  if (!Object.keys(persons).length) throw new Error('No encuentro filas de personas (número en la columna A y nombre en la B).')
  if (codes[BLANK] === undefined) warnings.push('No hay celdas vacías: revisa si el diurno aparece con otro código.')

  const all = Object.values(grid).flatMap((r) => Object.keys(r)).sort()
  return { persons, grid, from: all[0], to: all[all.length - 1], codes, warnings }
}

// Fila de días de la semana (L M X J V S D) o de letras del mes: no es un rótulo de sección.
function headerLike(row: Cell[], cols: number[]): boolean {
  const letters = cols.filter((c) => /^[A-ZÁÉÍÓÚÑ]$/i.test(text(row[c]))).length
  return letters >= Math.min(5, cols.length)
}

// Une plantillas leídas de varias hojas del mismo archivo.
export function mergeParsed(parts: ParsedPlantilla[]): ParsedPlantilla {
  if (parts.length === 1) return parts[0]
  const persons: Record<string, Person> = {}
  const grid: Grid = {}
  const warnings: string[] = []
  let conflicts = 0
  for (const p of parts) {
    warnings.push(...p.warnings)
    for (const [id, person] of Object.entries(p.persons)) persons[id] ??= person
    for (const [id, row] of Object.entries(p.grid)) {
      const target = (grid[id] ??= {})
      for (const [date, code] of Object.entries(row)) {
        if (target[date] === undefined) target[date] = code
        else if (target[date] !== code) conflicts++
      }
    }
  }
  if (conflicts) warnings.push(`${conflicts} días con valores distintos entre hojas; se ha mantenido el de la primera hoja.`)
  const codes: Record<string, number> = {}
  for (const row of Object.values(grid)) for (const c of Object.values(row)) codes[c] = (codes[c] ?? 0) + 1
  const all = Object.values(grid).flatMap((r) => Object.keys(r)).sort()
  return { persons, grid, from: all[0], to: all[all.length - 1], codes, warnings: [...new Set(warnings)] }
}

// Meses que trae una plantilla, con cuántas personas tienen datos en cada uno.
export function monthsSummary(p: ParsedPlantilla): { month: string; persons: number }[] {
  const by: Record<string, Set<string>> = {}
  for (const [id, row] of Object.entries(p.grid)) for (const d of Object.keys(row)) (by[d.slice(0, 7)] ??= new Set()).add(id)
  return Object.keys(by)
    .sort()
    .map((month) => ({ month, persons: by[month].size }))
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
