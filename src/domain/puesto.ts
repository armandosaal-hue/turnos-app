import type { Person } from './types'

// Orden del número asignado en la plantilla (columna A), como en el Excel:
// primero los números (10 antes que 10.1), luego los que llevan letra (s1, s3, S11)
// y al final quien no tiene número. A igual número, por nombre.
export function puestoKey(puesto: string): [number, string, number] {
  const p = puesto.trim()
  if (!p) return [2, '', 0]
  if (/^\d+(\.\d+)?$/.test(p)) return [0, '', parseFloat(p)]
  const m = /^([^\d]*)(\d+(?:\.\d+)?)?/.exec(p)!
  return [1, m[1].toLowerCase(), m[2] ? parseFloat(m[2]) : 0]
}

export function comparePuesto(a: string, b: string): number {
  const ka = puestoKey(a)
  const kb = puestoKey(b)
  return ka[0] - kb[0] || ka[1].localeCompare(kb[1]) || ka[2] - kb[2]
}

export function byPuesto(a: Person, b: Person): number {
  return comparePuesto(a.puesto, b.puesto) || a.name.localeCompare(b.name)
}
