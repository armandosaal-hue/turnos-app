// Prueba opcional con una plantilla real: REAL_XLSX=/ruta/plantilla.xlsx npm test
// El archivo no se guarda en el proyecto (contiene datos personales).
import { readFileSync } from 'node:fs'
import { readSheet } from 'read-excel-file/universal'
import { parsePlantilla } from './importer'
import { recommend } from './engine'
import { emptyState, analyzeImport, applyImport, unknownCodes } from './state'

const path = process.env.REAL_XLSX
describe.skipIf(!path)('plantilla real', () => {
  it('se importa y genera recomendaciones', async () => {
    const rows = await readSheet(new Blob([readFileSync(path!)]))
    const parsed = parsePlantilla(rows as never)
    let s = emptyState()
    console.log('personas', Object.keys(parsed.persons).length, parsed.from, parsed.to, parsed.warnings)
    console.log('códigos desconocidos', unknownCodes(s, parsed))
    console.log('secciones', [...new Set(Object.values(parsed.persons).map((p) => p.section))])
    console.log('no candidatos', Object.values(parsed.persons).filter((p) => !p.candidate).map((p) => p.name))
    s = applyImport(s, parsed, analyzeImport(s, parsed), 'real.xlsx')
    const me = Object.keys(s.grid)[5]
    const t0 = performance.now()
    const myDates = Object.entries(s.grid[me]).filter(([, c]) => c === '' || c === 'N').map(([d]) => d)
    const r = recommend(s, me, myDates[3])
    console.log('yo (prueba)', me, myDates[3], s.grid[me][myDates[3]] || 'diurno', r.type, 'ms', Math.round(performance.now() - t0))
    console.log('candidatos', r.candidates.length, 'descartados', r.discarded.length)
    for (const c of r.candidates.slice(0, 3)) console.log(c.name, c.score, c.reasons.join(' | '), 'devoluciones', c.returns.length, c.returns.slice(0, 3).map((x) => x.date))
    const reasons: Record<string, number> = {}
    for (const d of r.discarded) reasons[d.reason.replace(/\(.*\)/, '').replace(/a \S+ le deja.*/, 'a X le deja…')] = (reasons[d.reason.replace(/\(.*\)/, '').replace(/a \S+ le deja.*/, 'a X le deja…')] ?? 0) + 1
    console.log(reasons)
    expect(r.candidates.length).toBeGreaterThan(0)
    // Reimportar el mismo archivo no produce diferencias.
    expect(analyzeImport(s, parsed).diffs).toHaveLength(0)
  })
})
