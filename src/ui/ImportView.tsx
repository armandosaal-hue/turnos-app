import { lazy, Suspense, useState } from 'react'
import readXlsxFile from 'read-excel-file/universal'
import { monthsSummary, parseCsv, parsePlantilla, parseWorkbook, type Cell, type ParsedPlantilla } from '../domain/importer'
import { codeLabel, suggestCode } from '../domain/legend'
import { fmtShort, MONTHS } from '../domain/dates'
import { analyzeImport, applyImport, unknownCodes, type ImportAnalysis } from '../domain/state'
import type { AppState, Kind, ShiftCode } from '../domain/types'
import { CodeChip } from './common'
import { Icon } from './icons'
import { fileKind } from '../fileKind'
import { readRowColors } from '../domain/xlsxColors'

// La lectura de fotos (y el cliente de la API) solo se descarga cuando se usa.
const ImageImport = lazy(() => import('./ImageImport').then((m) => ({ default: m.ImageImport })))
const ChatImport = lazy(() => import('./ChatImport').then((m) => ({ default: m.ChatImport })))

type Step =
  | { s: 'idle' }
  | { s: 'images'; files: File[] }
  | { s: 'chat' }
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

  // Tras leer una plantilla (Excel o fotos): códigos nuevos y después diferencias.
  const next = (parsed: ParsedPlantilla, fileName: string) => {
    const unknown = unknownCodes(state, parsed)
    if (unknown.length) {
      const defs: Record<string, ShiftCode> = {}
      for (const c of unknown) {
        const sug = suggestCode(state.legend, c)
        defs[c] = sug ? { ...state.legend[sug], code: c } : { code: c, name: 'Sin descripción', kind: 'ausencia', confirmed: true }
      }
      setStep({ s: 'codes', parsed, fileName, defs })
    } else {
      setStep({ s: 'review', parsed, fileName, analysis: analyzeImport(state, parsed) })
    }
  }

  const onFiles = async (list: FileList) => {
    setError('')
    setBusy(true)
    const files = [...list]
    let kinds: Awaited<ReturnType<typeof fileKind>>[]
    try {
      kinds = await Promise.all(files.map(fileKind))
    } catch (e) {
      setError(`No se pueden leer los archivos: ${e instanceof Error ? e.message : String(e)}`)
      setBusy(false)
      return
    } finally {
      setBusy(false)
    }
    const images = files.filter((_, i) => kinds[i] === 'image')
    const heic = kinds.filter((k) => k === 'heic').length
    const notes: string[] = []
    if (heic) notes.push(`${heic} ${heic === 1 ? 'foto está' : 'fotos están'} en formato HEIC (iPhone), que el navegador no abre: envíala por WhatsApp o guárdala como JPG.`)
    if (images.length) {
      if (images.length + heic !== files.length) notes.push('Has mezclado fotos con otros archivos: se cargan solo las fotos.')
      setError(notes.join(' '))
      setStep({ s: 'images', files: images })
      return
    }
    const i = kinds.findIndex((k) => k === 'xlsx' || k === 'csv')
    if (i < 0) {
      setError(notes.join(' ') || 'No reconozco el archivo. Usa fotos (JPG, PNG, las de WhatsApp), Excel (.xlsx) o CSV. Los .xls antiguos: ábrelos y guárdalos como .xlsx.')
      return
    }
    const file = files[i]
    setBusy(true)
    try {
      if (kinds[i] === 'csv') next(parsePlantilla(parseCsv(await file.text())), file.name)
      else {
        const sheets = (await readXlsxFile(file)) as { sheet: string; data: Cell[][] }[]
        next(parseWorkbook(sheets, readRowColors(new Uint8Array(await file.arrayBuffer()))), file.name)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (step.s === 'images') {
    return (
      <Suspense fallback={<div className="empty">Cargando…</div>}>
        {error && <p className="warn">{error}</p>}
        <ImageImport files={step.files} state={state} onCancel={() => setStep({ s: 'idle' })} onParsed={next} onUseChat={() => setStep({ s: 'chat' })} />
      </Suspense>
    )
  }

  if (step.s === 'chat') {
    return (
      <Suspense fallback={<div className="empty">Cargando…</div>}>
        <ChatImport state={state} onCancel={() => setStep({ s: 'idle' })} onParsed={next} />
      </Suspense>
    )
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
        <div className="stepper">
          <span className="on">1 · Elegir</span>
          <span className="on">2 · Revisar</span>
          <span>3 · Guardar</span>
        </div>
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
        <div className="stepper">
          <span className="on">1 · Elegir</span>
          <span className="on">2 · Revisar</span>
          <span className="on">3 · Guardar</span>
        </div>
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
          <p>
            Meses:{' '}
            {monthsSummary(parsed)
              .map((m) => `${monthName(m.month)} (${m.persons} personas)`)
              .join(' · ')}
          </p>
          {!first && analysis.newPersons.length > 0 && <p>Personas nuevas: {analysis.newPersons.join(', ')}</p>}
        </div>
        {!first && (analysis.removedMonths.length > 0 || analysis.removedPersons > 0) && (
          <p className="warn">
            Al guardar, la app se queda solo con este archivo.
            {analysis.removedMonths.length > 0 && ` Se borrarán ${analysis.removedMonths.map(monthName).join(', ')}.`}
            {analysis.removedPersons > 0 && ` Dejan de aparecer ${analysis.removedPersons} personas que no están en el archivo.`}
            {' '}Tus cambios registrados se conservan en la pestaña Cambios.
          </p>
        )}
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
      <div className="stepper">
        <span className="on">1 · Elegir</span>
        <span>2 · Revisar</span>
        <span>3 · Guardar</span>
      </div>
      <div className="col">
        <label className="source card highlight">
          <span className="source-ico">
            <Icon name="sheet" />
          </span>
          <span className="source-text">
            <b>Excel o fotos desde Archivos</b>
            <small>.xlsx, .csv o imágenes guardadas (también las de WhatsApp)</small>
          </span>
          <input
            id="plantilla"
            type="file"
            multiple
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.length) onFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <label className="source card">
          <span className="source-ico">
            <Icon name="image" />
          </span>
          <span className="source-text">
            <b>Fotos de la galería</b>
            <small>Puedes elegir varias a la vez</small>
          </span>
          <input
            id="galeria"
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.length) onFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <button className="source card" onClick={() => setStep({ s: 'chat' })}>
          <span className="source-ico">
            <Icon name="chat" />
          </span>
          <span className="source-text">
            <b>Leer fotos con mi chat de Claude</b>
            <small>Sin clave de API: copias unas instrucciones y pegas la respuesta</small>
          </span>
        </button>
      </div>
      {busy && <p className="hint">Abriendo…</p>}
      <p className="hint">
        Cada archivo sustituye a lo anterior; antes de guardar verás qué cambia. Si la galería se queda en negro, usa <b>Archivos</b>: las fotos de WhatsApp
        están en Imágenes o en la carpeta WhatsApp Images.
      </p>
      <div>
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

function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1].toLowerCase()} ${y}`
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
