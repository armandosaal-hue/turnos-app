import { useState } from 'react'
import { isoDate, MONTHS, WEEKDAY_SHORT, weekday } from '../domain/dates'
import type { ParsedPlantilla } from '../domain/importer'
import type { AppState } from '../domain/types'
import { chatPrompt, detectedMonth, parsePastedReadings, readingsToPlantilla, type Reading, type VisionPlantilla } from '../domain/vision'
import { ReviewGrid } from './ImageImport'

// Lectura de fotos con el chat de Claude: se copian unas instrucciones, se envían con
// las fotos en la app de Claude y se pega aquí la respuesta.
export function ChatImport({
  state,
  onCancel,
  onParsed,
}: {
  state: AppState
  onCancel: () => void
  onParsed: (parsed: ParsedPlantilla, label: string) => void
}) {
  const prompt = chatPrompt()
  const [copied, setCopied] = useState<'' | 'ok' | 'manual'>('')
  const [pasted, setPasted] = useState('')
  const [readings, setReadings] = useState<Reading[]>([])
  const [error, setError] = useState('')
  const [ym, setYm] = useState<{ year: number; month: number } | null>(null)
  const [review, setReview] = useState<VisionPlantilla | null>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied('ok')
    } catch {
      setCopied('manual')
    }
  }

  const add = () => {
    setError('')
    try {
      const r = parsePastedReadings(pasted)
      const all = [...readings, ...r]
      setReadings(all)
      setPasted('')
      if (!ym) {
        const now = new Date()
        setYm(detectedMonth(all.map((reading, i) => ({ fileName: `foto ${i + 1}`, reading }))) ?? { year: now.getFullYear(), month: now.getMonth() + 1 })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (review && ym) {
    return (
      <ReviewGrid
        plantilla={review}
        state={state}
        images={[]}
        onBack={() => setReview(null)}
        onChange={setReview}
        onAccept={() => onParsed(review, `chat de Claude · ${MONTHS[ym.month - 1].toLowerCase()} ${ym.year}`)}
      />
    )
  }

  const rows = readings.reduce((n, r) => n + r.filas.length, 0)
  return (
    <div className="view">
      <h2>Leer fotos con tu chat de Claude</h2>
      <div className="card">
        <p>
          <b>1. Copia las instrucciones</b>
        </p>
        <button className="primary" onClick={copy}>Copiar instrucciones</button>
        {copied === 'ok' && <p className="ok">Copiadas.</p>}
        {copied === 'manual' && (
          <>
            <p className="hint">No se han podido copiar solas. Mantén pulsado el texto, elige "Seleccionar todo" y cópialo.</p>
            <textarea id="instrucciones" readOnly value={prompt} rows={6} onFocus={(e) => e.target.select()} />
          </>
        )}
      </div>
      <div className="card">
        <p>
          <b>2. En la app de Claude</b>
        </p>
        <ol className="steps">
          <li>Abre un chat nuevo.</li>
          <li>Adjunta las fotos de la plantilla (mejor 1 o 2 por mensaje).</li>
          <li>Pega las instrucciones y envía.</li>
          <li>Cuando responda, mantén pulsada la respuesta y pulsa <b>Copiar</b>.</li>
        </ol>
        <p className="hint">Si tienes más fotos, repite en un mensaje nuevo con las siguientes y pega cada respuesta aquí.</p>
      </div>
      <div className="card">
        <p>
          <b>3. Pega la respuesta</b>
        </p>
        <textarea id="respuesta" value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6} placeholder="Pega aquí la respuesta de Claude" />
        <div className="row">
          <button className="primary" disabled={!pasted.trim()} onClick={add}>Añadir respuesta</button>
        </div>
        {error && <p className="warn">{error}</p>}
        {readings.length > 0 && (
          <p className="ok">
            Leídas {readings.length} {readings.length === 1 ? 'foto' : 'fotos'} con {rows} filas.
          </p>
        )}
      </div>

      {ym && readings.length > 0 && (
        <div className="card">
          <p>
            <b>Mes de la plantilla</b>
          </p>
          <div className="row">
            <select id="mes-chat" value={ym.month} onChange={(e) => setYm({ ...ym, month: Number(e.target.value) })}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m.toLowerCase()}</option>
              ))}
            </select>
            <input id="anio-chat" type="number" value={ym.year} onChange={(e) => setYm({ ...ym, year: Number(e.target.value) || ym.year })} />
          </div>
          <p className="hint">
            El día 1 de {MONTHS[ym.month - 1].toLowerCase()} de {ym.year} es {WEEKDAY_SHORT[weekday(isoDate(ym.year, ym.month, 1))]}. Compruébalo con la plantilla.
          </p>
        </div>
      )}

      <div className="row">
        <button onClick={onCancel}>Cancelar</button>
        {ym && readings.length > 0 && (
          <button
            className="primary"
            onClick={() => {
              try {
                setReview(readingsToPlantilla(readings.map((reading, i) => ({ fileName: `foto ${i + 1}`, reading })), ym.year, ym.month))
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
              }
            }}
          >
            Revisar lo leído
          </button>
        )}
      </div>
      <p className="hint">Las fotos van a tu chat de Claude, no a esta app. Aquí solo se guarda la tabla, en tu móvil.</p>
    </div>
  )
}
