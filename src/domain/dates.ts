const DAY_MS = 86_400_000

export function dayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

export function fromDayIndex(i: number): string {
  return new Date(i * DAY_MS).toISOString().slice(0, 10)
}

export function addDays(iso: string, n: number): string {
  return fromDayIndex(dayIndex(iso) + n)
}

export function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

// 0 = domingo
export function weekday(iso: string): number {
  return new Date(dayIndex(iso) * DAY_MS).getUTCDay()
}

export function isWeekend(iso: string): boolean {
  const w = weekday(iso)
  return w === 0 || w === 6
}

export const WEEKDAY_LETTER = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
export const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
export const MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

export function fmtShort(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${WEEKDAY_SHORT[weekday(iso)]} ${d}/${m}`
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}
