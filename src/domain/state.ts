import { allDates, cambioCells } from './engine'
import type { ParsedPlantilla } from './importer'
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
  return { diffs, newPersons, confirmedCambios, notReflected }
}

// Aplica una plantilla. Las celdas con diferencia solo se sobrescriben si su
// fila de diferencias está marcada; el resto de celdas de la plantilla se copian.
export function applyImport(
  state: AppState,
  parsed: ParsedPlantilla,
  analysis: ImportAnalysis,
  fileName: string,
): AppState {
  const keep = new Set(analysis.diffs.filter((d) => !d.apply).map((d) => `${d.personId}|${d.date}`))
  const grid = { ...state.grid }
  const origins: Origins = { ...state.origins }
  const persons = { ...state.persons }

  for (const [pid, p] of Object.entries(parsed.persons)) {
    if (!persons[pid]) persons[pid] = p
    else persons[pid] = { ...persons[pid], note: p.note, puesto: p.puesto, section: p.section }
  }
  for (const [pid, row] of Object.entries(parsed.grid)) {
    const target = { ...(grid[pid] ?? {}) }
    const o = { ...(origins[pid] ?? {}) }
    for (const [date, code] of Object.entries(row)) {
      if (keep.has(`${pid}|${date}`)) continue
      target[date] = code
      delete o[date]
    }
    grid[pid] = target
    origins[pid] = o
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
  return {
    ...state,
    grid: { ...state.grid, [personId]: { ...state.grid[personId], [date]: code } },
    origins: { ...state.origins, [personId]: { ...(state.origins[personId] ?? {}), [date]: { origin: 'manual' } } },
  }
}

export function dateRange(state: AppState): string[] {
  return allDates(state.grid)
}

// Códigos de una plantilla que no están en la leyenda.
export function unknownCodes(state: AppState, parsed: ParsedPlantilla): string[] {
  return Object.keys(parsed.codes).filter((c) => !state.legend[c])
}
