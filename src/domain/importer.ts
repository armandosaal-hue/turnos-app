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
    // Grupos de letras sueltas seguidas en la fila. Si la hoja empieza con los últimos días
    // del mes anterior, puede haber dos meses escritos: vale el que empieza más cerca del día 1.
    let word = ''
    let best: { month: number; dist: number } | null = null
    for (let c = 0; c <= row.length; c++) {
      const t = c < row.length ? text(row[c]) : ''
      if (/^[A-ZÁÉÍÓÚÑ]$/i.test(t)) word += t.toUpperCase()
      else {
        const i = MONTHS.indexOf(word)
        const dist = Math.abs(c - word.length - c0)
        if (i >= 0 && dist <= 3 && (!best || dist < best.dist)) best = { month: i + 1, dist }
        word = ''
      }
    }
    if (best) return best.month
    let idx: number
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
// ¿Es una fila de días de la semana (L M X J V S D) y no una de persona?
function isWeekdayRow(row: Cell[] | undefined, cells: number[]): boolean {
  if (!row || text(row[0])) return false
  const letters = cells.filter((c) => /^[LMXJVSD]$/i.test(text(row[c]))).length
  return letters >= Math.min(5, cells.length)
}

// Columna -> fecha a partir de una fila de días. Si la numeración vuelve a empezar, pasa de
// mes. Con fila de días de la semana, cada columna se asigna al mes en que ese día cae en
// esa letra: así se resuelven hojas a las que les han borrado columnas (p. ej. de octubre
// solo quedan el 30 y el 31, pegados al 30 de septiembre y sin rótulo).
function columnDates(header: Cell[], c0: number, year: number, month: number, wrow?: Cell[]): Record<number, string> {
  const cells: number[] = []
  for (let c = c0; c < header.length && dayNumber(header[c]) !== null; c++) cells.push(c)
  const good = (cd: Record<number, string>) => {
    const w = weekdayScore(cd, wrow)
    return w.total === 0 || w.ok / w.total >= 0.9
  }
  let plain: Record<number, string> | null = null
  let plainError: unknown
  try {
    plain = sequentialDates(header, cells, year, month, undefined)
  } catch (e) {
    plainError = e
  }
  if (plain && good(plain)) return plain
  if (isWeekdayRow(wrow, cells)) {
    try {
      const smart = sequentialDates(header, cells, year, month, wrow)
      if (good(smart)) return smart
    } catch {
      // sigue con la numeración normal
    }
  }
  if (plain) return plain
  throw plainError
}

function sequentialDates(header: Cell[], cells: number[], year: number, month: number, wrow?: Cell[]): Record<number, string> {
  const colDate: Record<number, string> = {}
  const useWeekdays = !!wrow
  let prevDate = ''
  let prev = 0
  let y = year
  let m = month
  const next = (yy: number, mm: number): [number, number] => (mm === 12 ? [yy + 1, 1] : [yy, mm + 1])
  for (const c of cells) {
    const d = dayNumber(header[c])!
    const letter = useWeekdays ? text(wrow![c]).toUpperCase() : ''
    if (/^[LMXJVSD]$/.test(letter)) {
      let cand: [number, number] = [y, m]
      let found: [number, number] | null = null
      for (let k = 0; k < 3 && !found; k++) {
        const [cy, cm] = cand
        if (d <= daysInMonth(cy, cm)) {
          const iso = isoDate(cy, cm, d)
          if (iso > prevDate && WEEKDAY_LETTER[weekday(iso)] === letter) found = cand
        }
        cand = next(cand[0], cand[1])
      }
      if (found) {
        ;[y, m] = found
        colDate[c] = isoDate(y, m, d)
        prevDate = colDate[c]
        prev = d
        continue
      }
    }
    if (d < prev) [y, m] = next(y, m)
    if (d > daysInMonth(y, m)) throw new Error(`Día ${d} no existe en ${MONTHS[m - 1].toLowerCase()} de ${y}.`)
    colDate[c] = isoDate(y, m, d)
    prevDate = colDate[c]
    prev = d
  }
  return colDate
}

const MONTH_ABBR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

// Mes y año a partir de un texto suelto, como el nombre de una pestaña ("NOVIEMBRE", "Nov 26").
export function monthYearFromName(name: string): { month: number | null; year: number | null } {
  const t = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  let month: number | null = null
  const full = MONTHS.findIndex((m) => new RegExp(`(^|[^A-Z])${m.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}([^A-Z]|$)`).test(t))
  if (full >= 0) month = full + 1
  else {
    const ab = MONTH_ABBR.findIndex((m) => new RegExp(`(^|[^A-Z])${m}(T)?([^A-Z]|$)`).test(t))
    if (ab >= 0) month = ab + 1
  }
  const y4 = t.match(/(^|\D)(20\d\d)(\D|$)/)
  const y2 = t.match(/(^|[^\d])(\d\d)$/)
  const year = y4 ? Number(y4[2]) : y2 && month ? 2000 + Number(y2[2]) : null
  return { month, year }
}

export interface ParseHints {
  sheetName?: string
  year?: number // año de la hoja anterior, si esta no lo trae
}

export function hasDayHeader(rows: Cell[][]): boolean {
  return rows.slice(0, 40).some((r) => headerCol(r ?? []) >= 0)
}

// Coincidencias con la fila de días de la semana (L M X J V S D) si existe. Una fila de
// persona (con puesto en la columna A) o con pocas letras no cuenta como tal.
function weekdayScore(colDate: Record<number, string>, wrow: Cell[] | undefined): { ok: number; total: number } {
  const cells = Object.keys(colDate).map(Number)
  const letters = cells.filter((c) => /^[LMXJVSD]$/i.test(text(wrow?.[c]))).length
  if (!wrow || text(wrow[0]) || letters < Math.min(5, cells.length)) return { ok: 0, total: 0 }
  let ok = 0
  let total = 0
  for (const [c, date] of Object.entries(colDate)) {
    const t = text(wrow?.[Number(c)]).toUpperCase()
    if (!/^[LMXJVSD]$/.test(t)) continue
    total++
    if (t === WEEKDAY_LETTER[weekday(date)]) ok++
  }
  return { ok, total }
}

function tryDates(header: Cell[], c0: number, year: number, month: number, wrow?: Cell[]): Record<number, string> | null {
  try {
    return columnDates(header, c0, year, month, wrow)
  } catch {
    return null
  }
}

// Fechas de un bloque. Prueba primero los meses indicados (el escrito encima del día 1 y
// el del nombre de la pestaña); si no cuadran con el número de días o con la fila de días
// de la semana, busca el mes que sí cuadra.
function blockDates(header: Cell[], wrow: Cell[] | undefined, c0: number, year: number, months: (number | null)[]): Record<number, string> {
  const fits = (cd: Record<number, string> | null) => {
    if (!cd) return false
    const w = weekdayScore(cd, wrow)
    return w.total === 0 || w.ok / w.total >= 0.9
  }
  for (const m of months) {
    if (m === null) continue
    const cd = tryDates(header, c0, year, m, wrow)
    if (fits(cd)) return cd!
  }
  const prefer = months.filter((m): m is number => m !== null)
  let best: { cd: Record<number, string>; score: number } | null = null
  for (const y of [year, year - 1, year + 1]) {
    for (let m = 1; m <= 12; m++) {
      const cd = tryDates(header, c0, y, m, wrow)
      if (!cd) continue
      const w = weekdayScore(cd, wrow)
      if (w.total === 0 || w.ok / w.total < 0.9) continue
      const score = w.ok * 10 + (prefer.includes(m) ? 5 : 0) + (y === year ? 2 : 0) - Math.min(...prefer.map((p) => Math.abs(p - m)), 12) * 0.1
      if (!best || score > best.score) best = { cd, score }
    }
  }
  if (best) return best.cd
  // Sin pistas suficientes: el error del mes escrito explica el problema.
  return columnDates(header, c0, year, prefer[0] ?? 1, wrow)
}

export function parsePlantilla(rows: Cell[][], hints: ParseHints = {}): ParsedPlantilla {
  const warnings: string[] = []

  // 1. Primera fila de días.
  let h = -1
  let c0 = -1
  for (let r = 0; r < Math.min(rows.length, 40) && h < 0; r++) {
    c0 = headerCol(rows[r] ?? [])
    if (c0 >= 0) h = r
  }
  if (h < 0) throw new Error('No encuentro la fila con los días del mes (1, 2, 3…).')

  const fromName = hints.sheetName ? monthYearFromName(hints.sheetName) : { month: null, year: null }
  const year = yearNear(rows, h) ?? fromName.year ?? hints.year ?? null
  if (year === null) throw new Error('No encuentro el año en la cabecera.')
  const month = monthNear(rows, h, c0)
  if (month === null && fromName.month === null && weekdayScore(tryDates(rows[h], c0, year, 1) ?? {}, rows[h + 1]).total === 0) {
    throw new Error('No encuentro el nombre del mes encima del día 1 ni en el nombre de la pestaña.')
  }

  let colDate = blockDates(rows[h], rows[h + 1], c0, year, [month, fromName.month])
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
          colDate = blockDates(row, rows[r + 1], hc, ny, [nm])
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

// Lee todas las pestañas con fila de días y las une. Si una no se puede leer, avisa de
// cuál y por qué en lugar de descartarla en silencio.
export function parseWorkbook(sheets: { sheet: string; data: Cell[][] }[]): ParsedPlantilla {
  const parts: ParsedPlantilla[] = []
  const failed: string[] = []
  let firstError: unknown
  let year: number | undefined
  for (const s of sheets) {
    if (!hasDayHeader(s.data)) continue
    try {
      const p = parsePlantilla(s.data, { sheetName: s.sheet, year })
      parts.push(p)
      year = Number(p.to.slice(0, 4))
    } catch (e) {
      firstError ??= e
      failed.push(`Pestaña "${s.sheet}": ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (!parts.length) throw firstError ?? new Error('El archivo no tiene ninguna pestaña con plantilla (fila de días 1, 2, 3…).')
  const merged = mergeParsed(parts)
  return { ...merged, warnings: [...failed.map((f) => `No se ha cargado. ${f}`), ...merged.warnings] }
}

// Une plantillas leídas de varias hojas del mismo archivo. Si dos hojas traen el mismo
// día, manda la que tiene más días de ese mes (la hoja del mes frente a un resto en otra).
export function mergeParsed(parts: ParsedPlantilla[]): ParsedPlantilla {
  if (parts.length === 1) return parts[0]
  const coverage = parts.map((p) => {
    const days: Record<string, Set<string>> = {}
    for (const row of Object.values(p.grid)) for (const d of Object.keys(row)) (days[d.slice(0, 7)] ??= new Set()).add(d)
    return (month: string) => days[month]?.size ?? 0
  })
  const persons: Record<string, Person> = {}
  const grid: Grid = {}
  const owner: Record<string, number> = {} // "id|fecha" -> índice de la hoja que manda
  const warnings: string[] = []
  let conflicts = 0
  parts.forEach((p, i) => {
    warnings.push(...p.warnings)
    for (const [id, person] of Object.entries(p.persons)) persons[id] ??= person
    for (const [id, row] of Object.entries(p.grid)) {
      const target = (grid[id] ??= {})
      for (const [date, code] of Object.entries(row)) {
        const key = `${id}|${date}`
        const prev = owner[key]
        if (prev === undefined) {
          target[date] = code
          owner[key] = i
        } else if (coverage[i](date.slice(0, 7)) > coverage[prev](date.slice(0, 7))) {
          if (target[date] !== code) conflicts++
          target[date] = code
          owner[key] = i
        } else if (target[date] !== code) conflicts++
      }
    }
  })
  if (conflicts) warnings.push(`${conflicts} días aparecen distintos en dos pestañas; se ha usado la pestaña que tiene el mes completo.`)
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
