import { useState } from 'react'
import { readSheet } from 'read-excel-file/universal'
import { parseCsv, parsePlantilla, type Cell, type ParsedPlantilla } from '../domain/importer'
import { codeLabel, suggestCode } from '../domain/legend'
import { fmtShort } from '../domain/dates'
import { analyzeImport, applyImport, unknownCodes, type ImportAnalysis } from '../domain/state'
import type { AppState, Kind, ShiftCode } from '../domain/types'
import { CodeChip } from './common'

type Step =
  | { s: 'idle' }
  | { s: 'codes'; parsed: ParsedPlantilla; fileName: string; defs: Record<string, ShiftCode> }
  | { s: 'review'; parsed: ParsedPlantilla; fileName: string; analysis: ImportAnalysis }

const KINDS: [Kind, string][] = [
  ['ausencia', 'No disponible'],
  ['libre', 'Libre (puede cubrir)'],
  ['trabajo', 'Turno de 12 h'],
  ['ocupado', 'Trabaja (no intercambiable)'],
]

export function ImportView({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [step, setStep] = useState<Step>({ s: 'idle' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onFile = async (file: File) => {
    setError('')
    setBusy(true)
    try {
      let rows: Cell[][]
      if (/\.csv$/i.test(file.name)) rows = parseCsv(await file.text())
      else if (/\.xlsx$/i.test(file.name)) rows = (await readSheet(file)) as Cell[][]
      else throw new Error('Formato no admitido. Usa .xlsx o .csv (los .xls antiguos: ábrelos y guárdalos como .xlsx).')
      const parsed = parsePlantilla(rows)
      const unknown = unknownCodes(state, parsed)
      if (unknown.length) {
        const defs: Record<string, ShiftCode> = {}
        for (const c of unknown) {
          const sug = suggestCode(state.legend, c)
          defs[c] = sug ? { ...state.legend[sug], code: c } : { code: c, name: 'Sin descripción', kind: 'ausencia', confirmed: true }
        }
        setStep({ s: 'codes', parsed, fileName: file.name, defs })
      } else {
        setStep({ s: 'review', parsed, fileName: file.name, analysis: analyzeImport(state, parsed) })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (step.s === 'codes') {
    const set = (code: string, patch: Partial<ShiftCode>) =>
      setStep({ ...step, defs: { ...step.defs, [code]: { ...step.defs[code], ...patch } } })
    const save = () => {
      const legend = { ...state.legend, ...step.defs }
      const next = { ...state, legend }
      setState(next)
      setStep({ s: 'review', parsed: step.parsed, fileName: step.fileName, analysis: analyzeImport(next, step.parsed) })
    }
    return (
      <div className="view">
        <h2>Códigos nuevos</h2>
        <p className="hint">
          La plantilla tiene códigos que no están en la leyenda. Por defecto cuentan como <b>no disponible</b>. Revisa cada uno.
        </p>
        {Object.values(step.defs).map((d) => {
          const sug = suggestCode(state.legend, d.code)
          return (
            <div className="card" key={d.code}>
              <p>
                <CodeChip code={d.code} legend={{ [d.code]: d }} /> aparece {step.parsed.codes[d.code]} veces
                {sug && (
                  <small className="hint"> · parecido a {codeLabel(state.legend, sug)}; se han copiado sus datos</small>
                )}
              </p>
              <label className="field">
                <span>Descripción</span>
                <input value={d.name} onChange={(e) => set(d.code, { name: e.target.value })} />
              </label>
              <CodeKindFields def={d} onChange={(p) => set(d.code, p)} />
            </div>
          )
        })}
        <div className="row">
          <button onClick={() => setStep({ s: 'idle' })}>Cancelar</button>
          <button className="primary" onClick={save}>Guardar y continuar</button>
        </div>
      </div>
    )
  }

  if (step.s === 'review') {
    const { parsed, analysis } = step
    const first = Object.keys(state.grid).length === 0
    const toggle = (i: number) => {
      const diffs = analysis.diffs.map((d, j) => (j === i ? { ...d, apply: !d.apply } : d))
      setStep({ ...step, analysis: { ...analysis, diffs } })
    }
    const accept = () => {
      setState(applyImport(state, parsed, analysis, step.fileName))
      setStep({ s: 'idle' })
    }
    const nameOf = (pid: string) => state.persons[pid]?.name ?? pid
    return (
      <div className="view">
        <h2>Revisión</h2>
        <div className="card">
          <p>
            <b>{step.fileName}</b>
          </p>
          <p>
            {Object.keys(parsed.persons).length} personas · del {fmtShort(parsed.from)} al {fmtShort(parsed.to)}
          </p>
          {parsed.warnings.map((w) => (
            <p key={w} className="warn">{w}</p>
          ))}
          {!first && analysis.newPersons.length > 0 && <p>Personas nuevas: {analysis.newPersons.join(', ')}</p>}
        </div>
        {!first && (
          <>
            {analysis.confirmedCambios.length > 0 && (
              <p className="ok">La plantilla recoge {analysis.confirmedCambios.length} de tus cambios: pasan a confirmados.</p>
            )}
            {analysis.notReflected.map((id) => {
              const c = state.cambios.find((x) => x.id === id)!
              return (
                <p key={id} className="warn">
                  Tu cambio del {fmtShort(c.date)} con {nameOf(c.partnerId)} no aparece en la plantilla (¿pendiente o no aprobado?).
                </p>
              )
            })}
            <h2>{analysis.diffs.length} diferencias con lo que tienes guardado</h2>
            {analysis.diffs.length === 0 && <p className="hint">No hay cambios respecto a la versión anterior.</p>}
            <div className="diffs">
              {analysis.diffs.map((d, i) => (
                <label key={`${d.personId}${d.date}`} className={`diff d-${d.kind}`}>
                  <input type="checkbox" checked={d.apply} onChange={() => toggle(i)} />
                  <span className="diff-text">
                    <b>{d.name}</b> {fmtShort(d.date)}: <CodeChip code={d.current} legend={state.legend} small /> →{' '}
                    <CodeChip code={d.incoming} legend={state.legend} small />
                    <small>
                      {d.kind === 'cambio-pendiente' && ' · era un cambio tuyo pendiente (se mantiene si no marcas)'}
                      {d.kind === 'manual' && ' · era una edición manual (se mantiene si no marcas)'}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
        <div className="row">
          <button onClick={() => setStep({ s: 'idle' })}>Cancelar</button>
          <button className="primary" onClick={accept}>
            {first ? 'Guardar plantilla' : 'Aplicar versión'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="view">
      <div className="card">
        <h2>Cargar plantilla</h2>
        <p className="hint">Excel (.xlsx) o CSV. Si el periodo ya está cargado, verás solo las diferencias.</p>
        <label className="file">
          <input
            id="plantilla"
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          {busy ? 'Leyendo…' : 'Elegir archivo'}
        </label>
        <p className="hint">Si no se abre el selector de archivos (pasa en la app de Claude en Android), abre esta página en Chrome.</p>
        {error && <p className="warn">{error}</p>}
      </div>
      <h2>Versiones cargadas</h2>
      {state.versions.length === 0 && <p className="hint">Ninguna todavía.</p>}
      {state.versions.map((v, i) => (
        <div key={v.id} className="card ver">
          <b>{v.fileName}</b> {i === 0 && <span className="tag">vigente</span>}
          <small>
            {new Date(v.importedAt).toLocaleString('es-ES')} · {v.persons} personas · {fmtShort(v.from)} – {fmtShort(v.to)}
          </small>
        </div>
      ))}
    </div>
  )
}

export function CodeKindFields({ def, onChange }: { def: ShiftCode; onChange: (p: Partial<ShiftCode>) => void }) {
  const timed = def.kind === 'trabajo' || def.kind === 'ocupado'
  return (
    <>
      <label className="field">
        <span>Tipo</span>
        <select value={def.kind} onChange={(e) => onChange({ kind: e.target.value as Kind })}>
          {KINDS.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </label>
      {timed && (
        <div className="row">
          <label className="field">
            <span>Inicio</span>
            <input type="time" value={def.start ?? ''} onChange={(e) => onChange({ start: e.target.value })} />
          </label>
          <label className="field">
            <span>Fin</span>
            <input type="time" value={def.end ?? ''} onChange={(e) => onChange({ end: e.target.value })} />
          </label>
        </div>
      )}
    </>
  )
}
