// Prueba opcional con un Excel real de varias pestañas: REAL_XLSX2=/ruta.xlsx npx vitest run src/domain/real2.local.test.ts
import { readFileSync } from 'node:fs'
import readXlsxFile from 'read-excel-file/universal'
import { monthsSummary, parseWorkbook, type Cell } from './importer'

const path = process.env.REAL_XLSX2
describe.skipIf(!path)('Excel real con pestañas', () => {
  it('lee todas las pestañas', async () => {
    const sheets = (await readXlsxFile(new Blob([readFileSync(path!)]))) as { sheet: string; data: Cell[][] }[]
    const p = parseWorkbook(sheets)
    console.log('pestañas', sheets.map((s) => s.sheet), 'rango', p.from, p.to)
    console.log('avisos', p.warnings)
    console.log('meses', monthsSummary(p).map((m) => `${m.month}:${m.persons}`).join(' '))
    const ids = Object.keys(p.grid)
    const someone = ids.find((id) => p.grid[id]['2026-11-01'] !== undefined)!
    const row = p.grid[someone]
    console.log(someone, 'oct 28-31:', ['28', '29', '30', '31'].map((d) => row[`2026-10-${d}`]), 'nov 1-5:', ['01', '02', '03', '04', '05'].map((d) => row[`2026-11-${d}`]), 'dic 1:', row['2026-12-01'])
    console.log('candidatos/fijos:', Object.values(p.persons).filter((x) => x.candidate).length, Object.values(p.persons).filter((x) => !x.candidate).length)
    expect(monthsSummary(p).some((m) => m.month === '2026-11')).toBe(true)
  })
})
