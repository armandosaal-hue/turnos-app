// Tipo de un código de turno para el motor:
// - trabajo: turno de 12 h que se puede ceder o cubrir
// - ocupado: trabaja, pero el turno no entra en cambios (p. ej. 7 h)
// - libre: puede cubrir un turno
// - ausencia: no disponible
export type Kind = 'trabajo' | 'ocupado' | 'libre' | 'ausencia'

export interface ShiftCode {
  code: string
  name: string
  kind: Kind
  start?: string // "HH:MM"
  end?: string // "HH:MM"; si es <= start, termina al día siguiente
  confirmed: boolean // false = código detectado en una plantilla y aún sin definir
}

export type Legend = Record<string, ShiftCode>

// Código de la celda vacía (diurno de 12 h en el Excel de la unidad).
export const BLANK = ''

export interface Person {
  id: string
  name: string
  note: string // texto entre paréntesis del Excel, p. ej. "RJ 85%"
  puesto: string
  section: string
  candidate: boolean
}

// personId -> fecha ISO -> código. Sin entrada = sin datos ese día.
export type Grid = Record<string, Record<string, string>>

export type Origin = { origin: 'manual' } | { origin: 'cambio'; cambioId: string }
export type Origins = Record<string, Record<string, Origin>>

export interface Rules {
  restAfterNight: { enabled: boolean; nightCode: string; restCode: string }
  maxContinuousHours: { enabled: boolean; hard: boolean; hours: number }
  forbiddenSequences: { enabled: boolean; hard: boolean; items: { from: string; to: string }[] }
  maxConsecutiveWorkDays: { enabled: boolean; hard: boolean; value: number }
  maxConsecutiveNights: { enabled: boolean; hard: boolean; value: number }
}

export interface Violation {
  key: string
  hard: boolean
  message: string
}

export type CambioType = 'quitar' | 'trabajar'

export interface CellChange {
  personId: string
  date: string
  before: string
  after: string
}

export interface Cambio {
  id: string
  type: CambioType
  date: string
  partnerId: string
  returnDate?: string
  cells: CellChange[]
  status: 'pendiente' | 'confirmado'
  notReflected?: boolean // la última plantilla oficial no lo recoge
  createdAt: string
}

export interface VersionMeta {
  id: string
  importedAt: string
  fileName: string
  from: string
  to: string
  persons: number
}

export interface AppState {
  schema: 1
  legend: Legend
  rules: Rules
  persons: Record<string, Person>
  grid: Grid
  origins: Origins
  versions: VersionMeta[]
  cambios: Cambio[]
  meId?: string
}
