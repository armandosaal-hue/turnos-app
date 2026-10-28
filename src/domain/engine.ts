import { addDays, dayIndex, fmtShort, isWeekend } from './dates'
import { codeLabel, kindOf } from './legend'
import { newViolations, violations } from './rules'
import type { AppState, Cambio, CambioType, CellChange, Grid, Legend, Rules } from './types'

export interface ReturnOption {
  date: string
  myCode: string // lo que tengo yo ese día antes del cambio
  partnerCode: string // lo que tiene el compañero ese día antes del cambio
  score: number
  notes: string[]
}

export interface Candidate {
  personId: string
  name: string
  codeOnDate: string
  score: number
  reasons: string[]
  softIssues: string[]
  balance: number
  returns: ReturnOption[]
  fit: number // encaje del día en su calendario (>0 encadena, <0 le parte libres)
  preferred?: { option: ReturnOption } | { reason: string } // solo si propongo fecha de devolución
}

export interface Discarded {
  personId: string
  name: string
  reason: string
}

export interface Recommendation {
  type?: CambioType
  myCode?: string
  error?: string
  candidates: Candidate[]
  discarded: Discarded[]
}

type Row = Record<string, string>

interface Ctx {
  legend: Legend
  rules: Rules
  grid: Grid
}

// ¿Puede esta persona trabajar ese día? Devuelve el motivo si no.
export function unavailableReason(ctx: Ctx, row: Row, date: string): string | null {
  const code = row[date]
  if (code === undefined) return 'sin datos ese día'
  const kind = kindOf(ctx.legend, code)
  if (kind === 'trabajo' || kind === 'ocupado') return `trabaja ese día (${codeLabel(ctx.legend, code)})`
  if (kind === 'ausencia') return `no disponible (${codeLabel(ctx.legend, code)})`
  const ran = ctx.rules.restAfterNight
  if (ran.enabled && code === ran.restCode && row[addDays(date, -1)] === ran.nightCode) {
    return 'es el descanso posterior a su noche'
  }
  return null
}

function isSwappable(ctx: Ctx, code: string | undefined): boolean {
  return code !== undefined && kindOf(ctx.legend, code) === 'trabajo'
}

// Las infracciones del calendario original se calculan una vez por persona.
const baseCache = new WeakMap<Row, { legend: Legend; rules: Rules; v: ReturnType<typeof violations> }>()

function hardAndSoft(ctx: Ctx, before: Row, after: Row) {
  let base = baseCache.get(before)
  if (!base || base.legend !== ctx.legend || base.rules !== ctx.rules) {
    base = { legend: ctx.legend, rules: ctx.rules, v: violations(before, ctx.legend, ctx.rules) }
    baseCache.set(before, base)
  }
  const nv = newViolations(base.v, violations(after, ctx.legend, ctx.rules))
  return { hard: nv.filter((v) => v.hard), soft: nv.filter((v) => !v.hard) }
}

function runAround(ctx: Ctx, row: Row, date: string): number {
  const working = (d: string) => {
    const c = row[d]
    if (c === undefined) return false
    const k = kindOf(ctx.legend, c)
    return k === 'trabajo' || k === 'ocupado'
  }
  if (!working(date)) return 0
  let n = 1
  for (let d = addDays(date, -1); working(d); d = addDays(d, -1)) n++
  for (let d = addDays(date, 1); working(d); d = addDays(d, 1)) n++
  return n
}

// Cómo encaja un día en el calendario de una persona, para el orden de candidatos:
// mucha gente prefiere encadenar turnos y librar seguido.
// "recibe": el día pasa a ser de trabajo; "cede": el día pasa a ser libre.
export function fitScore(ctx: Ctx, row: Row, date: string, role: 'recibe' | 'cede'): { score: number; note?: string } {
  if (ctx.rules.preferChains?.enabled === false) return { score: 0 }
  const ran = ctx.rules.restAfterNight
  const busy = (d: string) => {
    const c = row[d]
    if (c === undefined) return false
    const k = kindOf(ctx.legend, c)
    if (k === 'trabajo' || k === 'ocupado') return true
    return ran.enabled && c === ran.restCode && row[addDays(d, -1)] === ran.nightCode // saliente
  }
  const free = (d: string) => row[d] !== undefined && kindOf(ctx.legend, row[d]) === 'libre' && !busy(d)
  const freeRun = (from: string, step: number) => {
    let n = 0
    for (let d = from; free(d); d = addDays(d, step)) n++
    return n
  }
  const before = addDays(date, -1)
  const after = addDays(date, 1)
  if (role === 'recibe') {
    if (busy(before) || busy(after)) return { score: 12, note: 'encadena con sus turnos' }
    const l = freeRun(before, -1)
    const r = freeRun(after, 1)
    if (l && r) return { score: -(10 + 2 * Math.min(l, r)), note: `le parte ${l + r + 1} días libres en ${l} + ${r}` }
    return { score: 0 }
  }
  const total = freeRun(before, -1) + freeRun(after, 1)
  if (total) return { score: 6, note: `amplía sus libres a ${total + 1} días` }
  if (busy(before) && busy(after)) return { score: -4, note: 'le queda un libre suelto' }
  return { score: 0 }
}

// Saldo con un compañero: positivo = me debe días; negativo = le debo yo.
export function balanceWith(cambios: Cambio[], partnerId: string): number {
  let b = 0
  for (const c of cambios) {
    if (c.partnerId !== partnerId || c.returnDate) continue
    b += c.type === 'quitar' ? -1 : 1
  }
  return b
}

interface Pair {
  ctx: Ctx
  type: CambioType
  date: string
  shift: string // turno que se mueve el día D
  me: Row
  row: Row
  meAfter: Row
  pAfter: Row
  partnerName: string
}

// Devolución en el día R: se intercambian los papeles del día D.
// Devuelve la opción válida o el motivo por el que no vale.
export function checkReturn(pair: Pair, r: string): { option: ReturnOption } | { reason: string } {
  const { ctx, type, date, shift, me, row, meAfter, pAfter } = pair
  const name = firstName(pair.partnerName)
  if (r === date) return { reason: 'es el mismo día del cambio' }
  const giver = type === 'quitar' ? row : me // quien tiene turno en R
  const taker = type === 'quitar' ? me : row // quien lo cubre en R
  const giverCode = giver[r]
  if (!isSwappable(ctx, giverCode)) {
    const who = type === 'quitar' ? `${name} no tiene` : 'no tienes'
    return { reason: giverCode === undefined ? `sin datos de ${type === 'quitar' ? name : 'ti'} ese día` : `${who} turno de 12 h ese día (${codeLabel(ctx.legend, giverCode)})` }
  }
  const busy = unavailableReason(ctx, taker, r)
  if (busy) return { reason: type === 'quitar' ? `tú: ${busy}` : `${name}: ${busy}` }
  const takerCode = taker[r]
  const meRet: Row = { ...meAfter, [r]: type === 'quitar' ? giverCode : takerCode }
  const pRet: Row = { ...pAfter, [r]: type === 'quitar' ? takerCode : giverCode }
  const m2 = hardAndSoft(ctx, me, meRet)
  if (m2.hard.length) return { reason: `a ti te deja ${m2.hard[0].message}` }
  const p2 = hardAndSoft(ctx, row, pRet)
  if (p2.hard.length) return { reason: `a ${name} le deja ${p2.hard[0].message}` }
  const notes: string[] = []
  let score = 100 - Math.abs(dayIndex(r) - dayIndex(date))
  if (giverCode === shift) {
    score += 15
    notes.push('mismo turno')
  }
  if (isWeekend(r) === isWeekend(date)) score += 5
  if (isWeekend(r) && isWeekend(date)) notes.push('finde por finde')
  const myFit = fitScore(ctx, meRet, r, type === 'quitar' ? 'recibe' : 'cede')
  const theirFit = fitScore(ctx, pRet, r, type === 'quitar' ? 'cede' : 'recibe')
  score += myFit.score + theirFit.score
  if (myFit.note) notes.push(`a ti: ${myFit.note}`)
  if (theirFit.note) notes.push(`a ${name}: ${theirFit.note}`)
  const soft = [...m2.soft, ...p2.soft]
  score -= soft.length * 20
  for (const s of soft) notes.push(`aviso: ${s.message}`)
  return { option: { date: r, myCode: me[r], partnerCode: row[r], score, notes } }
}

export interface RecommendOptions {
  preferredReturn?: string // devolución que propongo yo
}

export function recommend(state: AppState, meId: string, date: string, opts: RecommendOptions = {}): Recommendation {
  const ctx: Ctx = { legend: state.legend, rules: state.rules, grid: state.grid }
  const me = state.grid[meId]
  const empty = { candidates: [], discarded: [] }
  if (!me) return { ...empty, error: 'No tengo tu calendario cargado.' }
  const myCode = me[date]
  if (myCode === undefined) return { ...empty, error: 'No hay datos tuyos para ese día.' }

  let type: CambioType
  if (isSwappable(ctx, myCode)) type = 'quitar'
  else {
    const why = unavailableReason(ctx, me, date)
    if (why) return { ...empty, myCode, error: `Ese día no puedes ponerte a trabajar: ${why}.` }
    type = 'trabajar'
  }

  const candidates: Candidate[] = []
  const discarded: Discarded[] = []
  const dates = allDates(state.grid)

  for (const p of Object.values(state.persons)) {
    if (p.id === meId) continue
    const row = state.grid[p.id]
    if (!row) continue
    const pc = row[date]
    const discard = (reason: string) => discarded.push({ personId: p.id, name: p.name, reason })
    if (!p.candidate) {
      discard('excluido de candidatos (turno fijo u opción en Ajustes)')
      continue
    }

    // Quién trabaja el día D tras el cambio, y qué turno.
    let shift: string
    if (type === 'quitar') {
      const why = unavailableReason(ctx, row, date)
      if (why) {
        discard(why)
        continue
      }
      shift = myCode
    } else {
      if (!isSwappable(ctx, pc)) {
        discard(pc === undefined ? 'sin datos ese día' : `no tiene turno de 12 h ese día (${codeLabel(ctx.legend, pc)})`)
        continue
      }
      shift = pc
    }

    const meAfter: Row = { ...me, [date]: type === 'quitar' ? pc : shift }
    const pAfter: Row = { ...row, [date]: type === 'quitar' ? shift : myCode }
    const mine = hardAndSoft(ctx, me, meAfter)
    const theirs = hardAndSoft(ctx, row, pAfter)
    if (theirs.hard.length) {
      discard(`a ${firstName(p.name)} le deja ${theirs.hard[0].message}`)
      continue
    }
    if (mine.hard.length) {
      discard(`a ti te deja ${mine.hard[0].message}`)
      continue
    }

    const pair: Pair = { ctx, type, date, shift, me, row, meAfter, pAfter, partnerName: p.name }
    const returns: ReturnOption[] = []
    for (const r of dates) {
      if (r === date) continue
      const res = checkReturn(pair, r)
      if ('option' in res) returns.push(res.option)
    }
    returns.sort((a, b) => b.score - a.score)

    const balance = balanceWith(state.cambios, p.id)
    const reasons: string[] = []
    reasons.push(
      type === 'quitar'
        ? `Ese día: ${codeLabel(ctx.legend, pc)}`
        : `Ese día trabaja: ${codeLabel(ctx.legend, pc)}`,
    )
    reasons.push(
      `Día anterior: ${codeLabel(ctx.legend, row[addDays(date, -1)])} · día siguiente: ${codeLabel(ctx.legend, row[addDays(date, 1)])}`,
    )
    if (balance > 0) reasons.push(`Te debe ${balance} ${balance === 1 ? 'día' : 'días'}`)
    if (balance < 0) reasons.push(`Le debes ${-balance} ${balance === -1 ? 'día' : 'días'}`)

    const softIssues = [...mine.soft, ...theirs.soft].map((v) => v.message)
    let score = 0
    if (returns.length) score += 40 + Math.min(returns.length, 10) * 2 + Math.round(returns[0].score / 20)
    score += balance * 10
    score -= softIssues.length * 15
    const fit = fitScore(ctx, pAfter, date, type === 'quitar' ? 'recibe' : 'cede')
    score += fit.score
    if (fit.note) reasons.push(`${fit.note.charAt(0).toUpperCase()}${fit.note.slice(1)}`)
    const run = runAround(ctx, pAfter, date)
    if (run > 3) {
      score -= (run - 3) * 5
      reasons.push(`Le quedarían ${run} días de trabajo seguidos`)
    }

    const preferred = opts.preferredReturn ? checkReturn(pair, opts.preferredReturn) : undefined
    candidates.push({ personId: p.id, name: p.name, codeOnDate: pc, score, reasons, softIssues, balance, returns, fit: fit.score, preferred })
  }

  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  discarded.sort((a, b) => a.name.localeCompare(b.name))
  return { type, myCode, candidates, discarded }
}

function firstName(name: string): string {
  return name.split(',')[1]?.trim() || name
}

export function allDates(grid: Grid): string[] {
  const set = new Set<string>()
  for (const row of Object.values(grid)) for (const d of Object.keys(row)) set.add(d)
  return [...set].sort()
}

// Celdas que cambian al registrar un cambio (y su devolución, si la hay).
export function cambioCells(
  state: AppState,
  meId: string,
  date: string,
  partnerId: string,
  returnDate?: string,
): CellChange[] {
  const me = state.grid[meId]
  const p = state.grid[partnerId]
  const cells: CellChange[] = [
    { personId: meId, date, before: me[date], after: p[date] },
    { personId: partnerId, date, before: p[date], after: me[date] },
  ]
  if (returnDate) {
    cells.push(
      { personId: meId, date: returnDate, before: me[returnDate], after: p[returnDate] },
      { personId: partnerId, date: returnDate, before: p[returnDate], after: me[returnDate] },
    )
  }
  return cells
}

export function describeDate(date: string): string {
  return fmtShort(date)
}
