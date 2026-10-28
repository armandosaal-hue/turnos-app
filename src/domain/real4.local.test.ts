// Prueba opcional: REAL_XLSX2=/ruta.xlsx npx vitest run src/domain/real4.local.test.ts
import { readFileSync } from 'node:fs'
import readXlsxFile from 'read-excel-file/universal'
import { parseWorkbook, type Cell } from './importer'
import { recommend } from './engine'
import { addDays } from './dates'
import { emptyState, analyzeImport, applyImport, ensureMe, editCells } from './state'

const path = process.env.REAL_XLSX2
describe.skipIf(!path)('segundo descanso disponible', () => {
  it('con la plantilla real de noviembre', async () => {
    const sheets = (await readXlsxFile(new Blob([readFileSync(path!)]))) as { sheet: string; data: Cell[][] }[]
    const parsed = parseWorkbook(sheets)
    let s = applyImport(emptyState(), parsed, analyzeImport(emptyState(), parsed), 'x')
    s = ensureMe(s, 'SÁNCHEZ ÁLVAREZ, ARMANDO')
    const nov = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)
    let firstD = 0, secondD = 0, okSecond = 0, blockedFirst = 0
    const motivosSegundo: Record<string, number> = {}
    for (const date of nov) {
      // Yo hago un diurno ese día y libro el resto del mes, para ver solo la regla del descanso.
      let t = s
      for (const d of nov) t = editCells(t, t.meId!, [d], d === date ? '' : 'L')
      const r = recommend(t, t.meId!, date)
      const cand = new Set(r.candidates.map((c) => c.personId))
      const why = Object.fromEntries(r.discarded.map((d) => [d.personId, d.reason]))
      for (const [id, row] of Object.entries(parsed.grid)) {
        if (row[date] !== 'D' || !t.persons[id]?.candidate) continue
        const prev = row[addDays(date, -1)]
        if (prev === 'N') {
          firstD++
          if (why[id]?.includes('descanso posterior')) blockedFirst++
        } else if (prev === 'D') {
          secondD++
          if (cand.has(id)) okSecond++
          else motivosSegundo[why[id]] = (motivosSegundo[why[id]] ?? 0) + 1
        }
      }
    }
    console.log(`D tras N: ${firstD}, bloqueados por "descanso posterior": ${blockedFirst}`)
    console.log(`Segundo D: ${secondD}, salen como candidatos: ${okSecond}`)
    console.log('Segundo D descartado por:', motivosSegundo)
    expect(blockedFirst).toBe(firstD)
  })
})
