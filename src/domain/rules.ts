import { addDays, dayIndex, fmtShort, minutesOf } from './dates'
import { kindOf } from './legend'
import type { Legend, Rules, Violation } from './types'

export function defaultRules(): Rules {
  return {
    restAfterNight: { enabled: true, nightCode: 'N', restCode: 'D' },
    maxContinuousHours: { enabled: true, hard: true, hours: 24 },
    forbiddenSequences: { enabled: true, hard: true, items: [] },
    maxConsecutiveWorkDays: { enabled: false, hard: true, value: 6 },
    maxConsecutiveNights: { enabled: false, hard: true, value: 4 },
  }
}

interface Interval {
  date: string
  code: string
  start: number // minutos absolutos
  end: number
}

function isWorking(legend: Legend, code: string): boolean {
  const k = kindOf(legend, code)
  return k === 'trabajo' || k === 'ocupado'
}

function intervalsOf(row: Record<string, string>, legend: Legend): Interval[] {
  const out: Interval[] = []
  for (const [date, code] of Object.entries(row)) {
    const c = legend[code]
    if (!c || !c.start || !c.end || !isWorking(legend, code)) continue
    const base = dayIndex(date) * 1440
    const s = minutesOf(c.start)
    let e = minutesOf(c.end)
    if (e <= s) e += 1440
    out.push({ date, code, start: base + s, end: base + e })
  }
  return out.sort((a, b) => a.start - b.start)
}

function isNightCode(legend: Legend, code: string): boolean {
  const c = legend[code]
  if (!c || !c.start || !c.end || kindOf(legend, code) !== 'trabajo') return false
  return minutesOf(c.end) <= minutesOf(c.start)
}

// Todas las infracciones del calendario de una persona. Se comparan antes y
// después de un cambio para quedarse solo con las que el cambio introduce.
export function violations(row: Record<string, string>, legend: Legend, rules: Rules): Violation[] {
  const out: Violation[] = []
  const ints = intervalsOf(row, legend)

  for (let i = 1; i < ints.length; i++) {
    if (ints[i].start < ints[i - 1].end) {
      out.push({
        key: `solape:${ints[i - 1].date}:${ints[i].date}`,
        hard: true,
        message: `turnos solapados (${fmtShort(ints[i - 1].date)} y ${fmtShort(ints[i].date)})`,
      })
    }
  }

  const mc = rules.maxContinuousHours
  if (mc.enabled && ints.length) {
    let blockStart = ints[0]
    let blockEnd = ints[0].end
    const flush = () => {
      const hours = (blockEnd - blockStart.start) / 60
      if (hours >= mc.hours) {
        out.push({
          key: `continuas:${blockStart.date}:${hours}`,
          hard: mc.hard,
          message: `${hours} h seguidas desde el ${fmtShort(blockStart.date)}`,
        })
      }
    }
    for (let i = 1; i < ints.length; i++) {
      if (ints[i].start <= blockEnd) {
        blockEnd = Math.max(blockEnd, ints[i].end)
      } else {
        flush()
        blockStart = ints[i]
        blockEnd = ints[i].end
      }
    }
    flush()
  }

  const fs = rules.forbiddenSequences
  if (fs.enabled && fs.items.length) {
    for (const [date, code] of Object.entries(row)) {
      const next = row[addDays(date, 1)]
      if (next === undefined) continue
      for (const it of fs.items) {
        if (it.from === code && it.to === next) {
          out.push({
            key: `secuencia:${date}:${it.from}>${it.to}`,
            hard: fs.hard,
            message: `secuencia prohibida ${it.from || 'diurno'} → ${it.to || 'diurno'} (${fmtShort(date)})`,
          })
        }
      }
    }
  }

  const runs = (pred: (code: string) => boolean, max: number, hard: boolean, label: string, keyName: string) => {
    const dates = Object.keys(row).sort()
    let runStart = ''
    let len = 0
    let prev = ''
    const flush = () => {
      if (len > max) {
        out.push({ key: `${keyName}:${runStart}:${len}`, hard, message: `${len} ${label} seguidos desde el ${fmtShort(runStart)}` })
      }
    }
    for (const d of dates) {
      if (pred(row[d]) && prev && addDays(prev, 1) === d && len > 0) {
        len++
      } else {
        flush()
        len = pred(row[d]) ? 1 : 0
        runStart = d
      }
      prev = d
    }
    flush()
  }
  const wd = rules.maxConsecutiveWorkDays
  if (wd.enabled) runs((c) => isWorking(legend, c), wd.value, wd.hard, 'días de trabajo', 'dias')
  const mn = rules.maxConsecutiveNights
  if (mn.enabled) runs((c) => isNightCode(legend, c), mn.value, mn.hard, 'noches', 'noches')

  return out
}

export function newViolations(before: Violation[], after: Violation[]): Violation[] {
  const keys = new Set(before.map((v) => v.key))
  return after.filter((v) => !keys.has(v.key))
}
