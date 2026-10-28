import { allDates, cambioCells } from './engine'
import { personKey, type ParsedPlantilla } from './importer'
import { defaultLegend } from './legend'
import { defaultRules } from './rules'
import type { AppState, Cambio, CambioType, Origins } from './types'

export function emptyState(): AppState {
  return {
    schema: 1,
    legend: defaultLegend(),
    rules: defaultRules(),
    persons: {},
    grid: {},
    origins: {},
    versions: [],
    cambios: [],
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export type DiffKind = 'nuevo' | 'confirma' | 'cambio-pendiente' | 'manual'

export interface DiffRow {
  personId: string
  name: string
  date: string
  current: string
  incoming: string
  kind: DiffKind
  cambioId?: string
  apply: boolean // valor por defecto: aplicar el valor de la plantilla
}

export interface ImportAnalysis {
  diffs: DiffRow[]
  newPersons: string[]
  confirmedCambios: string[] // ids de cambios que la plantilla ya recoge
  notReflected: string[] // ids de cambios pendientes que la plantilla no recoge
  removedMonths: string[] // meses guardados ("2026-01") que no trae el archivo y se borrarán
  removedPersons: number // personas que dejan de aparecer
}

function monthsOf(grid: Record<string, Record<string, string>>): Set<string> {
  const out = new Set<string>()
  for (const row of Object.values(grid)) for (const d of Object.keys(row)) out.add(d.slice(0, 7))
  return out
}

export function analyzeImport(state: AppState, parsed: ParsedPlantilla): ImportAnalysis {
  const diffs: DiffRow[] = []
  const newPersons: string[] = []
  for (const [pid, row] of Object.entries(parsed.grid)) {
    const cur = state.grid[pid]
    if (!cur) {
      newPersons.push(parsed.persons[pid].name)
      continue
    }
    for (const [date, incoming] of Object.entries(row)) {
      const current = cur[date]
      if (current === undefined || current === incoming) continue
      const o = state.origins[pid]?.[date]
      let kind: DiffKind = 'nuevo'
      let cambioId: string | undefined
      if (o?.origin === 'cambio') {
        kind = 'cambio-pendiente'
        cambioId = o.cambioId
      } else if (o?.origin === 'manual') kind = 'manual'
      diffs.push({
        personId: pid,
        name: state.persons[pid]?.name ?? parsed.persons[pid].name,
        date,
        current,
        incoming,
        kind,
        cambioId,
        apply: kind === 'nuevo',
      })
    }
  }

  const confirmedCambios: string[] = []
  const notReflected: string[] = []
  for (const c of state.cambios) {
    if (c.status === 'confirmado') continue
    const covered = c.cells.filter((cell) => parsed.grid[cell.personId]?.[cell.date] !== undefined)
    if (!covered.length) continue
    const all = covered.every((cell) => parsed.grid[cell.personId][cell.date] === cell.after)
    if (all) confirmedCambios.push(c.id)
    else notReflected.push(c.id)
  }
  diffs.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
  const incoming = monthsOf(parsed.grid)
  const removedMonths = [...monthsOf(state.grid)].filter((m) => !incoming.has(m)).sort()
  const removedPersons = Object.keys(state.persons).filter((id) => !parsed.persons[id] && id !== state.meId).length
  return { diffs, newPersons, confirmedCambios, notReflected, removedMonths, removedPersons }
}

// Aplica una plantilla: la tabla queda solo con lo que trae el archivo. Dentro de sus
// meses se conservan las celdas con diferencia que no se marcan (ediciones manuales y
// cambios pendientes) y mis días manuales que el archivo no trae. Lo demás se borra.
export function applyImport(
  state: AppState,
  parsed: ParsedPlantilla,
  analysis: ImportAnalysis,
  fileName: string,
): AppState {
  const keep = new Set(analysis.diffs.filter((d) => !d.apply).map((d) => `${d.personId}|${d.date}`))
  const months = monthsOf(parsed.grid)
  const grid: AppState['grid'] = {}
  const origins: Origins = {}
  const persons: AppState['persons'] = {}

  for (const [pid, p] of Object.entries(parsed.persons)) {
    const old = state.persons[pid]
    persons[pid] = old ? { ...old, note: p.note, puesto: p.puesto, group: p.group, section: p.section } : p
  }
  for (const [pid, row] of Object.entries(parsed.grid)) {
    const target: Record<string, string> = {}
    const o: Origins[string] = {}
    for (const [date, code] of Object.entries(row)) {
      const prev = state.origins[pid]?.[date]
      if (keep.has(`${pid}|${date}`) && prev) {
        target[date] = state.grid[pid][date]
        // "Volver a la plantilla" debe llevar a esta versión.
        o[date] = prev.origin === 'manual' ? { origin: 'manual', before: code } : prev
      } else target[date] = code
    }
    grid[pid] = target
    origins[pid] = o
  }
  // Días cambiados a mano o por un cambio, dentro de los meses del archivo, que el archivo no trae.
  for (const [pid, o] of Object.entries(state.origins)) {
    for (const [date, origin] of Object.entries(o)) {
      if (!months.has(date.slice(0, 7)) || parsed.grid[pid]?.[date] !== undefined) continue
      ;(grid[pid] ??= {})[date] = state.grid[pid][date]
      ;(origins[pid] ??= {})[date] = origin
      persons[pid] ??= state.persons[pid]
    }
  }
  if (state.meId && state.persons[state.meId]) {
    persons[state.meId] ??= state.persons[state.meId]
    grid[state.meId] ??= {}
  }

  const confirmed = new Set(analysis.confirmedCambios)
  const notReflected = new Set(analysis.notReflected)
  const cambios = state.cambios.map((c) =>
    confirmed.has(c.id)
      ? { ...c, status: 'confirmado' as const, notReflected: false }
      : notReflected.has(c.id)
        ? { ...c, notReflected: true }
        : c,
  )

  const dates = Object.values(parsed.grid).flatMap((r) => Object.keys(r))
  dates.sort()
  return {
    ...state,
    persons,
    grid,
    origins,
    cambios,
    versions: [
      {
        id: uid(),
        importedAt: new Date().toISOString(),
        fileName,
        from: dates[0] ?? parsed.from,
        to: dates[dates.length - 1] ?? parsed.to,
        persons: Object.keys(parsed.persons).length,
      },
      ...state.versions,
    ],
  }
}

export function registerCambio(
  state: AppState,
  meId: string,
  type: CambioType,
  date: string,
  partnerId: string,
  returnDate?: string,
): AppState {
  const id = uid()
  const cells = cambioCells(state, meId, date, partnerId, returnDate)
  const grid = { ...state.grid }
  const origins = { ...state.origins }
  for (const cell of cells) {
    grid[cell.personId] = { ...grid[cell.personId], [cell.date]: cell.after }
    origins[cell.personId] = { ...(origins[cell.personId] ?? {}), [cell.date]: { origin: 'cambio', cambioId: id } }
  }
  const cambio: Cambio = {
    id,
    type,
    date,
    partnerId,
    returnDate,
    cells,
    status: 'pendiente',
    createdAt: new Date().toISOString(),
  }
  return { ...state, grid, origins, cambios: [cambio, ...state.cambios] }
}

// Borra un cambio y devuelve las celdas a su valor anterior si nadie las ha tocado después.
export function deleteCambio(state: AppState, id: string): AppState {
  const c = state.cambios.find((x) => x.id === id)
  if (!c) return state
  const grid = { ...state.grid }
  const origins = { ...state.origins }
  for (const cell of c.cells) {
    const o = origins[cell.personId]?.[cell.date]
    if (o?.origin === 'cambio' && o.cambioId === id && grid[cell.personId]?.[cell.date] === cell.after) {
      grid[cell.personId] = { ...grid[cell.personId], [cell.date]: cell.before }
      const po = { ...origins[cell.personId] }
      delete po[cell.date]
      origins[cell.personId] = po
    }
  }
  return { ...state, grid, origins, cambios: state.cambios.filter((x) => x.id !== id) }
}

export function editCell(state: AppState, personId: string, date: string, code: string): AppState {
  return editCells(state, personId, [date], code)
}

// Cambia a mano varios días de una persona. Guarda el valor anterior la primera vez
// para poder deshacerlo con clearManual.
export function editCells(state: AppState, personId: string, dates: string[], code: string): AppState {
  const row = { ...(state.grid[personId] ?? {}) }
  const o = { ...(state.origins[personId] ?? {}) }
  for (const date of dates) {
    const prev = o[date]
    const before = prev?.origin === 'manual' ? prev.before : row[date]
    row[date] = code
    o[date] = { origin: 'manual', before }
  }
  return { ...state, grid: { ...state.grid, [personId]: row }, origins: { ...state.origins, [personId]: o } }
}

// Quita una edición manual y devuelve el día al valor que tenía (o lo deja sin dato).
export function clearManual(state: AppState, personId: string, dates: string[]): AppState {
  const row = { ...(state.grid[personId] ?? {}) }
  const o = { ...(state.origins[personId] ?? {}) }
  for (const date of dates) {
    const prev = o[date]
    if (prev?.origin !== 'manual') continue
    if (prev.before === undefined) delete row[date]
    else row[date] = prev.before
    delete o[date]
  }
  return { ...state, grid: { ...state.grid, [personId]: row }, origins: { ...state.origins, [personId]: o } }
}

// Me marca como "yo". Si no aparezco en ninguna plantilla, crea mi fila con la misma
// clave que usará la plantilla cuando salga mi nombre, para que se unan.
export function ensureMe(state: AppState, rawName: string): AppState {
  const { id, name, note } = personKey(rawName)
  if (!id) return state
  if (state.persons[id]) return { ...state, meId: id }
  return {
    ...state,
    meId: id,
    persons: { ...state.persons, [id]: { id, name, note, puesto: '', section: 'Rotatorio', candidate: false } },
    grid: { ...state.grid, [id]: state.grid[id] ?? {} },
  }
}

export function dateRange(state: AppState): string[] {
  return allDates(state.grid)
}

// Códigos de una plantilla que no están en la leyenda.
export function unknownCodes(state: AppState, parsed: ParsedPlantilla): string[] {
  return Object.keys(parsed.codes).filter((c) => !state.legend[c])
}
