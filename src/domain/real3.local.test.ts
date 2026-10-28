// Prueba opcional: REAL_XLSX2=/ruta.xlsx npx vitest run src/domain/real3.local.test.ts
import { readFileSync } from 'node:fs'
import readXlsxFile from 'read-excel-file/universal'
import { parseWorkbook, type Cell } from './importer'
import { recommend } from './engine'
import { emptyState, analyzeImport, applyImport, ensureMe, editCells } from './state'

const path = process.env.REAL_XLSX2
describe.skipIf(!path)('devoluciones sin mis turnos', () => {
  it('reproduce', async () => {
    const sheets = (await readXlsxFile(new Blob([readFileSync(path!)]))) as { sheet: string; data: Cell[][] }[]
    const parsed = parseWorkbook(sheets)
    let s = applyImport(emptyState(), parsed, analyzeImport(emptyState(), parsed), 'x')
    s = ensureMe(s, 'SÁNCHEZ ÁLVAREZ, ARMANDO')
    s = editCells(s, s.meId!, ['2026-11-13'], '')
    let r = recommend(s, s.meId!, '2026-11-13')
    console.log('solo el 13:', r.type, 'candidatos', r.candidates.length, 'con devolución', r.candidates.filter((c) => c.returns.length).length)
    // Con el mes completo (copio el patrón de una compañera para simularlo)
    const other = Object.keys(parsed.grid).find((id) => parsed.grid[id]['2026-11-13'] === '')!
    const nov = Object.fromEntries(Object.entries(parsed.grid[other]).filter(([d]) => d.startsWith('2026-11')))
    for (const [d, c] of Object.entries(nov)) s = editCells(s, s.meId!, [d], c)
    r = recommend(s, s.meId!, '2026-11-13')
    console.log('con el mes:', r.type, 'candidatos', r.candidates.length, 'con devolución', r.candidates.filter((c) => c.returns.length).length)
  })
})
