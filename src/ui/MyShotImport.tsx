import { useEffect, useMemo, useState } from 'react'
import { addDays, daysInMonth, isoDate, MONTHS, todayIso, weekday } from '../domain/dates'
import { kindOf } from '../domain/legend'
import { myCodes, myShotChatPrompt, parsePastedMyShots, shotsToMonths, type MyMonth, type MyShift, type MyShot } from '../domain/myshot'
import { editCells, ensureMe } from '../domain/state'
import type { AppState } from '../domain/types'
import { prepareImage } from '../image'
import { loadVisionSettings, type VisionSettings } from '../visionSettings'
import { CodeChip } from './common'

const NEXT: Record<MyShift, MyShift> = { diurno: 'noche', noche: 'otro', otro: 'diurno' }

// Actualiza solo mi fila a partir de capturas de mi app de turnos personal.
export function MyShotImport({ state, setState, onClose }: { state: AppState; setState: (s: AppState) => void; onClose: () => void }) {
  const [settings, setSettings] = useState<VisionSettings | null>(null)
  const [shots, setShots] = useState<MyShot[]>([])
  const [months, setMonths] = useState<MyMonth[] | null>(null)
  const [fallback, setFallback] = useState(() => todayIso().slice(0, 7))
  const [keepAbsences, setKeepAbsences] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [pasted, setPasted] = useState('')
  const [copied, setCopied] = useState<'' | 'ok' | 'manual'>('')
  const [name, setName] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    loadVisionSettings().then(setSettings)
  }, [])

  const meId = state.meId
  const ran = state.rules.restAfterNight
  const [fy, fm] = fallback.split('-').map(Number)
  const needsMonth = shots.some((s) => !(s.mes >= 1 && s.mes <= 12))
  const [ty, tm] = todayIso().slice(0, 7).split('-').map(Number)

  // Al cambiar el mes de respaldo se recalculan los meses (se pierden los retoques).
  useEffect(() => {
    if (shots.length) setMonths(shotsToMonths(shots, { year: fy, month: fm }, { year: ty, month: tm }))
  }, [shots, fy, fm, ty, tm])

  const current = meId ? state.grid[meId] ?? {} : {}
  const codes = useMemo(
    () => (months ? myCodes(months, current, state.legend, { nightCode: ran.nightCode, restCode: ran.restCode }) : {}),
    [months, current, state.legend, ran.nightCode, ran.restCode],
  )
  const toApply = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [d, c] of Object.entries(codes)) {
      const before = current[d]
      if (keepAbsences && before !== undefined && kindOf(state.legend, before) === 'ausencia' && kindOf(state.legend, c) === 'libre') continue
      if (before !== c) out[d] = c
    }
    return out
  }, [codes, current, keepAbsences, state.legend])

  if (!meId || !state.persons[meId]) {
    return (
      <div className="card">
        <h2>¿Quién eres?</h2>
        <p className="hint">Escribe tu nombre tal como aparecerá en la plantilla (APELLIDOS, NOMBRE).</p>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="APELLIDOS, NOMBRE" />
          <button className="primary" disabled={!name.includes(',')} onClick={() => setState(ensureMe(state, name))}>
            Guardar
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="card">
        <p className="ok">{done}</p>
        <button className="primary" onClick={onClose}>Hecho</button>
      </div>
    )
  }

  const readWithApi = async (files: File[]) => {
    if (!settings?.apiKey) return
    setError('')
    const api = await import('../vision')
    const out: MyShot[] = []
    for (const [i, f] of files.entries()) {
      setBusy(`Leyendo captura ${i + 1} de ${files.length}…`)
      try {
        out.push((await api.readMyShot(settings, await prepareImage(f, 0))).shot)
      } catch (e) {
        setError(`${f.name}: ${api.describeError(e)}`)
      }
    }
    setBusy('')
    if (out.length) setShots(out)
  }

  const addPasted = () => {
    setError('')
    try {
      setShots(parsePastedMyShots(pasted))
      setPasted('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(myShotChatPrompt())
      setCopied('ok')
    } catch {
      setCopied('manual')
    }
  }

  const save = () => {
    const byCode = new Map<string, string[]>()
    for (const [d, c] of Object.entries(toApply)) byCode.set(c, [...(byCode.get(c) ?? []), d])
    let next = state
    for (const [c, ds] of byCode) next = editCells(next, meId, ds, c)
    setState(next)
    const names = months!.map((m) => `${MONTHS[m.month - 1].toLowerCase()} ${m.year}`).join(', ')
    setDone(`Actualizados ${Object.keys(toApply).length} días tuyos (${names}). La plantilla de tus compañeros no se ha tocado.`)
  }

  const toggle = (mi: number, day: number) => {
    if (!months) return
    setMonths(months.map((m, i) => (i === mi ? { ...m, shifts: { ...m.shifts, [day]: NEXT[m.shifts[day] ?? 'otro'] } } : m)))
  }

  if (months) {
    const criterios = [...new Set(shots.map((s) => s.criterio).filter(Boolean))]
    const avisos = shots.flatMap((s) => s.avisos)
    return (
      <>
        <div className="card">
          <h2>Revisa tus turnos</h2>
          <p className="hint">
            Toca un día para cambiarlo: diurno → noche → libre. La D tras cada noche y la L del resto se ponen solas. Solo se cambia tu fila.
          </p>
          {criterios.map((c) => (
            <p key={c} className="hint">Cómo lo ha leído: {c}</p>
          ))}
          {avisos.map((a) => (
            <p key={a} className="warn">Aviso: {a}</p>
          ))}
          {needsMonth && (
            <label className="field">
              <span>Alguna captura no muestra el mes. ¿De qué mes es?</span>
              <input type="month" value={fallback} onChange={(e) => e.target.value && setFallback(e.target.value)} />
            </label>
          )}
        </div>
        {months.map((m, mi) => {
          const days = Array.from({ length: daysInMonth(m.year, m.month) }, (_, i) => isoDate(m.year, m.month, i + 1))
          return (
            <div key={`${m.year}-${m.month}`} className="card">
              <b>
                {MONTHS[m.month - 1].toLowerCase()} {m.year}
              </b>
              <div className="month">
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l) => (
                  <div key={l} className="mh">{l}</div>
                ))}
                {Array.from({ length: (weekday(days[0]) + 6) % 7 }, (_, i) => (
                  <div key={`e${i}`} />
                ))}
                {days.map((d, i) => (
                  <button
                    key={d}
                    className={`mday${m.doubtful.includes(i + 1) ? ' doubt' : ''}${d in toApply ? ' o-manual' : ''}`}
                    aria-label={`Día ${i + 1}`}
                    onClick={() => toggle(mi, i + 1)}
                  >
                    <span>{i + 1}</span>
                    <CodeChip code={codes[d]} prev={codes[addDays(d, -1)] ?? current[addDays(d, -1)]} legend={state.legend} small />
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        <div className="card">
          <label className="check">
            <input type="checkbox" checked={keepAbsences} onChange={(e) => setKeepAbsences(e.target.checked)} /> Mantener las vacaciones, bajas y permisos que ya tenía
            metidos
          </label>
          <p className="hint">
            Cambian {Object.keys(toApply).length} días. Borde discontinuo: día que cambia. Borde naranja: la lectura tiene dudas. Si un día pasa a ser
            libre pero estabas de vacaciones o de baja, la app te contará como disponible ese día.
          </p>
          <div className="row">
            <button
              onClick={() => {
                setShots([])
                setMonths(null)
              }}
            >
              Volver
            </button>
            <button className="primary" disabled={!Object.keys(toApply).length} onClick={save}>
              Guardar mis turnos
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="card">
        <h2>Captura de mi app de turnos</h2>
        <p className="hint">
          Sube una captura de pantalla del mes en tu app de turnos. Se leen solo los diurnos y las noches; tras cada noche se pone D y el resto de días
          quedan como libres. Solo se actualiza tu fila: la plantilla de los compañeros no se toca.
        </p>
        {settings?.apiKey ? (
          <label className="file">
            Elegir capturas
            <input type="file" accept="image/*" multiple onChange={(e) => e.target.files?.length && readWithApi([...e.target.files])} />
          </label>
        ) : (
          <p className="hint">Sin clave de API: usa tu chat de Claude (abajo). La clave se pone en Ajustes → Imágenes.</p>
        )}
        {busy && <p className="ok">{busy}</p>}
      </div>
      <div className="card">
        <p>
          <b>Con tu chat de Claude</b>
        </p>
        <ol className="steps">
          <li>Copia las instrucciones.</li>
          <li>En la app de Claude, adjunta la captura (o varias), pega las instrucciones y envía.</li>
          <li>Copia la respuesta entera y pégala aquí.</li>
        </ol>
        <button onClick={copy}>Copiar instrucciones</button>
        {copied === 'ok' && <p className="ok">Copiadas.</p>}
        {copied === 'manual' && <textarea readOnly value={myShotChatPrompt()} rows={5} onFocus={(e) => e.target.select()} />}
        <textarea id="respuesta-captura" value={pasted} onChange={(e) => setPasted(e.target.value)} rows={4} placeholder="Pega aquí la respuesta de Claude" />
        <button className="primary" disabled={!pasted.trim()} onClick={addPasted}>
          Leer respuesta
        </button>
      </div>
      {error && <p className="warn">{error}</p>}
      <button className="link" onClick={onClose}>Cancelar</button>
    </>
  )
}
