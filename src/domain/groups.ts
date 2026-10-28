import type { Candidate } from './engine'
import { kindOf } from './legend'
import type { AppState } from './types'
import { colorName } from './xlsxColors'

export type GroupTier = 'encadena' | 'sin-ciclo' | 'resto' | 'sin-grupo'

export interface GroupInfo {
  key: string
  color?: string
  name: string
  range: string // números de la plantilla del grupo, p. ej. "1–15"
  cycle: boolean // sus miembros hacen los diurnos los mismos días
  tier: GroupTier
  note: string
  candidates: Candidate[]
}

const TIER_ORDER: GroupTier[] = ['encadena', 'sin-ciclo', 'resto', 'sin-grupo']

// ¿Comparten ciclo? Media del solapamiento de días de diurno entre cada par de miembros.
// En la plantilla real: 0,25–0,40 dentro de un grupo y 0,05 entre grupos distintos.
export function sharesCycle(state: AppState, ids: string[]): boolean {
  const days = ids.map((id) => {
    const row = state.grid[id] ?? {}
    return new Set(Object.keys(row).filter((d) => kindOf(state.legend, row[d]) === 'trabajo' && !isNight(state, row[d])))
  })
  let sum = 0
  let pairs = 0
  for (let i = 0; i < days.length; i++)
    for (let j = i + 1; j < days.length; j++) {
      const a = days[i]
      const b = days[j]
      const union = new Set([...a, ...b]).size
      if (!union) continue
      let both = 0
      for (const d of a) if (b.has(d)) both++
      sum += both / union
      pairs++
    }
  return pairs > 0 && sum / pairs >= 0.15
}

function isNight(state: AppState, code: string): boolean {
  const c = state.legend[code]
  return !!c?.start && !!c?.end && c.end <= c.start
}

// Candidatos agrupados por color de la plantilla. Primero los grupos a los que el
// turno les encadena con su ciclo; después los grupos sin ciclo común (suplencias),
// luego el resto de grupos y al final quien no tiene color.
export function groupCandidates(state: AppState, candidates: Candidate[]): GroupInfo[] {
  const members: Record<string, string[]> = {}
  for (const p of Object.values(state.persons)) if (p.group) (members[p.group] ??= []).push(p.id)
  const byKey = new Map<string, Candidate[]>()
  for (const c of candidates) {
    const key = state.persons[c.personId]?.group ?? ''
    byKey.set(key, [...(byKey.get(key) ?? []), c])
  }
  const groups: GroupInfo[] = []
  for (const [key, list] of byKey) {
    if (!key) {
      groups.push({ key, name: 'Sin grupo de color', range: '', cycle: false, tier: 'sin-grupo', note: 'No tienen color en la plantilla.', candidates: list })
      continue
    }
    const cycle = sharesCycle(state, members[key] ?? [])
    const chains = list.filter((c) => c.fit > 0).length
    const tier: GroupTier = !cycle ? 'sin-ciclo' : chains * 2 >= list.length && chains > 0 ? 'encadena' : 'resto'
    const note =
      tier === 'encadena'
        ? 'El turno se junta con su ciclo: lo encadenan con sus turnos.'
        : tier === 'sin-ciclo'
          ? 'No comparten ciclo (suplencias o correturnos): se valora a cada uno por separado.'
          : chains
            ? 'A la mayoría el turno les cae suelto entre sus libres.'
            : 'El turno les cae suelto entre sus libres.'
    groups.push({ key, color: key, name: `Grupo ${colorName(key)}`, range: range(state, members[key] ?? []), cycle, tier, note, candidates: list })
  }
  const best = (g: GroupInfo) => Math.max(...g.candidates.map((c) => c.score))
  return groups.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || best(b) - best(a))
}

function range(state: AppState, ids: string[]): string {
  const nums = ids.map((id) => parseFloat(state.persons[id]?.puesto ?? '')).filter((n) => !Number.isNaN(n))
  if (!nums.length) {
    const raw = ids.map((id) => state.persons[id]?.puesto).filter(Boolean)
    return raw.length ? `${raw[0]}–${raw[raw.length - 1]}` : ''
  }
  // Sin números sueltos lejos del resto (alguien colocado en otro grupo).
  const sorted = [...nums].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const core = sorted.filter((n) => Math.abs(n - median) <= 20)
  const lo = Math.floor(core[0])
  const hi = Math.floor(core[core.length - 1])
  return lo === hi ? `${lo}` : `${lo}–${hi}`
}
