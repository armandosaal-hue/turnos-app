import { useEffect, useMemo, useState } from 'react'
import { daysInMonth, isoDate, MONTHS, WEEKDAY_SHORT, weekday, WEEKDAY_LETTER } from '../domain/dates'
import type { ParsedPlantilla } from '../domain/importer'
import { displayCode, kindOf } from '../domain/legend'
import type { AppState } from '../domain/types'
import { detectedMonth, readingsToPlantilla, type ImageReading, type VisionPlantilla } from '../domain/vision'
import { prepareImage } from '../image'
import { fileKind } from '../fileKind'
import { loadVisionSettings, saveVisionSettings, type VisionSettings } from '../visionSettings'

interface Img {
  id: string
  file: File
  url: string
  rotation: number
  status: 'pendiente' | 'leyendo' | 'hecha' | 'error'
  error?: string
  reading?: ImageReading['reading']
}

const QUICK = ['', 'N', 'D', 'L', 'Lh', 'B', 'V', 'x']

export function ImageImport({
  files,
  state,
  onCancel,
  onParsed,
  onUseChat,
}: {
  files: File[]
  state: AppState
  onCancel: () => void
  onParsed: (parsed: ParsedPlantilla, label: string) => void
  onUseChat: () => void
}) {
  const [settings, setSettings] = useState<VisionSettings | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [imgs, setImgs] = useState<Img[]>(() => files.map(toImg))
  const [cost, setCost] = useState(0)
  const [reading, setReading] = useState(false)
  const [ym, setYm] = useState<{ year: number; month: number } | null>(null)
  const [review, setReview] = useState<VisionPlantilla | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    loadVisionSettings().then(setSettings)
  }, [])
  useEffect(() => () => imgs.forEach((i) => URL.revokeObjectURL(i.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (id: string, patch: Partial<Img>) => setImgs((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  const readAll = async () => {
    if (!settings?.apiKey) return
    setReading(true)
    const queue = imgs.filter((i) => i.status !== 'hecha')
    // El cliente de la API se descarga aquí, al leer, no al abrir la pantalla.
    let api: typeof import('../vision')
    try {
      api = await import('../vision')
    } catch (e) {
      for (const img of queue) update(img.id, { status: 'error', error: `No se pudo cargar el lector: ${e instanceof Error ? e.message : String(e)}` })
      setReading(false)
      return
    }
    const worker = async () => {
      for (let img = queue.shift(); img; img = queue.shift()) {
        update(img.id, { status: 'leyendo', error: undefined })
        try {
          const data = await prepareImage(img.file, img.rotation)
          const res = await api.readImage(settings, data)
          setCost((c) => c + res.costUsd)
          update(img.id, { status: 'hecha', reading: res.reading })
        } catch (e) {
          update(img.id, { status: 'error', error: api.describeError(e) })
        }
      }
    }
    await Promise.all([worker(), worker()])
    setReading(false)
  }

  const done = imgs.filter((i) => i.status === 'hecha' && i.reading)
  const readings: ImageReading[] = done.map((i) => ({ fileName: i.file.name, reading: i.reading! }))

  // Mes y año: los de la imagen que los tenga; si no, el mes actual.
  useEffect(() => {
    if (ym || !readings.length || reading) return
    const now = new Date()
    setYm(detectedMonth(readings) ?? { year: now.getFullYear(), month: now.getMonth() + 1 })
  }, [readings.length, reading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!settings) return <div className="empty">Cargando…</div>

  if (!settings.apiKey) {
    return (
      <div className="view">
        <h2>Leer imágenes</h2>
        <div className="card">
          <p>Para leer fotos de la plantilla, la app usa la IA de Claude con tu propia clave de API de Anthropic.</p>
          <ol className="steps">
            <li>Entra en platform.claude.com, crea una cuenta y recarga saldo (prepago).</li>
            <li>En <b>API Keys</b>, pulsa <b>Create Key</b> y copia la clave (empieza por "sk-ant-").</li>
            <li>Pégala aquí. Se guarda solo en este dispositivo y no sale en las copias de seguridad.</li>
          </ol>
          <label className="field">
            <span>Clave de API</span>
            <input id="api-key" type="password" autoComplete="off" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value.trim())} placeholder="sk-ant-…" />
          </label>
          <p className="hint">
            ¿No tienes clave o no puedes pagar la API? Puedes leer las fotos con tu chat de Claude, sin coste aparte.
          </p>
          <div className="row">
            <button onClick={onCancel}>Cancelar</button>
            <button onClick={onUseChat}>Usar mi chat de Claude</button>
            <button
              className="primary"
              disabled={!keyDraft.startsWith('sk-')}
              onClick={async () => {
                const s = { ...settings, apiKey: keyDraft }
                await saveVisionSettings(s)
                setSettings(s)
              }}
            >
              Guardar clave
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (review && ym) {
    return (
      <ReviewGrid
        plantilla={review}
        state={state}
        images={imgs.filter((i) => i.status === 'hecha')}
        onBack={() => setReview(null)}
        onChange={setReview}
        onAccept={() => onParsed(review, `${done.length} ${done.length === 1 ? 'imagen' : 'imágenes'} · ${MONTHS[ym.month - 1].toLowerCase()} ${ym.year}`)}
      />
    )
  }

  const allDone = imgs.length > 0 && imgs.every((i) => i.status === 'hecha')
  return (
    <div className="view">
      <h2>Fotos de la plantilla</h2>
      <p className="hint">
        Gira las que estén de lado para que el texto se lea en horizontal. Puedes mezclar páginas troceadas por personas o por fechas: se unen por nombre y día.
      </p>
      <div className="thumbs">
        {imgs.map((i) => (
          <div key={i.id} className={`thumb st-${i.status}`}>
            <div className="thumb-img">
              <img src={i.url} alt={i.file.name} style={{ transform: `rotate(${i.rotation}deg)` }} />
            </div>
            <div className="thumb-bar">
              <button aria-label="Girar" disabled={reading || i.status === 'hecha'} onClick={() => update(i.id, { rotation: (i.rotation + 90) % 360 })}>
                ↻
              </button>
              <small>{i.status === 'leyendo' ? 'leyendo…' : i.status === 'hecha' ? `${i.reading?.filas.length ?? 0} filas` : i.status}</small>
              <button aria-label="Quitar" disabled={reading} onClick={() => setImgs((l) => l.filter((x) => x.id !== i.id))}>
                ✕
              </button>
            </div>
            {i.error && <p className="warn small">{i.error}</p>}
          </div>
        ))}
      </div>
      <label className="file">
        <input
          id="mas-fotos"
          type="file"
          multiple
          disabled={reading}
          onChange={async (e) => {
            const list = [...(e.target.files ?? [])]
            e.target.value = ''
            const kinds = await Promise.all(list.map(fileKind))
            setImgs((l) => [...l, ...list.filter((_, i) => kinds[i] === 'image').map(toImg)])
          }}
        />
        Añadir más fotos
      </label>
      <p className="hint">
        Las fotos se envían a la API de Anthropic para leerlas (contienen nombres y turnos de tus compañeros). El resultado se guarda solo en tu móvil.
      </p>
      {cost > 0 && <p className="hint">Coste de la lectura: {cost.toFixed(3)} US$ aprox.</p>}

      {ym && done.length > 0 && !reading && (
        <div className="card">
          <p>
            <b>Mes de la plantilla</b>
          </p>
          <div className="row">
            <select id="mes" value={ym.month} onChange={(e) => setYm({ ...ym, month: Number(e.target.value) })}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m.toLowerCase()}</option>
              ))}
            </select>
            <input id="anio" type="number" value={ym.year} onChange={(e) => setYm({ ...ym, year: Number(e.target.value) || ym.year })} />
          </div>
          <p className="hint">
            El día 1 de {MONTHS[ym.month - 1].toLowerCase()} de {ym.year} es {WEEKDAY_SHORT[weekday(isoDate(ym.year, ym.month, 1))]}. Compruébalo con la fila de días de la plantilla.
          </p>
        </div>
      )}

      {err && <p className="warn">{err}</p>}
      <div className="row">
        <button onClick={onCancel} disabled={reading}>Cancelar</button>
        {!allDone && (
          <button className="primary" disabled={reading || !imgs.length} onClick={readAll}>
            {reading ? 'Leyendo…' : imgs.some((i) => i.status === 'error') ? 'Reintentar las que fallaron' : `Leer ${imgs.length} ${imgs.length === 1 ? 'foto' : 'fotos'}`}
          </button>
        )}
        {done.length > 0 && !reading && ym && (
          <button
            className="primary"
            onClick={() => {
              try {
                setReview(readingsToPlantilla(readings, ym.year, ym.month))
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e))
              }
            }}
          >
            Revisar lo leído
          </button>
        )}
      </div>
    </div>
  )
}

// Muestra la foto ya girada a tamaño completo para compararla con la tabla.
function RotatedPhoto({ img }: { img: Img }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    prepareImage(img.file, img.rotation).then((b64) => alive && setSrc(`data:image/jpeg;base64,${b64}`))
    return () => {
      alive = false
    }
  }, [img.file, img.rotation])
  return <div className="photo">{src ? <img src={src} alt={img.file.name} /> : <p className="hint">Cargando foto…</p>}</div>
}

let seq = 0
function toImg(file: File): Img {
  return { id: `${Date.now()}-${seq++}`, file, url: URL.createObjectURL(file), rotation: 0, status: 'pendiente' }
}

export function ReviewGrid({
  plantilla,
  state,
  images,
  onBack,
  onChange,
  onAccept,
}: {
  plantilla: VisionPlantilla
  state: AppState
  images: Img[]
  onBack: () => void
  onChange: (p: VisionPlantilla) => void
  onAccept: () => void
}) {
  const [onlyDoubt, setOnlyDoubt] = useState(false)
  const [edit, setEdit] = useState<{ pid: string; date: string } | null>(null)
  const [draft, setDraft] = useState('')
  const [showImgs, setShowImgs] = useState(false)

  const dates = useMemo(() => {
    const [y, m] = plantilla.from.split('-').map(Number)
    const set = new Set(Object.values(plantilla.grid).flatMap((r) => Object.keys(r)))
    // Todos los días del periodo, aunque falte alguno en la lectura.
    const out: string[] = []
    for (let yy = y, mm = m; isoDate(yy, mm, 1) <= plantilla.to; mm === 12 ? ((mm = 1), yy++) : mm++) {
      for (let d = 1; d <= daysInMonth(yy, mm); d++) {
        const iso = isoDate(yy, mm, d)
        if (iso >= plantilla.from && iso <= plantilla.to) out.push(iso)
      }
    }
    return out.length ? out : [...set].sort()
  }, [plantilla])

  const doubtCount = Object.keys(plantilla.doubtful).length
  const persons = Object.values(plantilla.persons)
    .filter((p) => !onlyDoubt || dates.some((d) => plantilla.doubtful[`${p.id}|${d}`]))
    .sort((a, b) => a.name.localeCompare(b.name))

  const setCell = (pid: string, date: string, code: string) => {
    const doubtful = { ...plantilla.doubtful }
    delete doubtful[`${pid}|${date}`]
    const grid = { ...plantilla.grid, [pid]: { ...plantilla.grid[pid], [date]: code } }
    const codes: Record<string, number> = {}
    for (const r of Object.values(grid)) for (const c of Object.values(r)) codes[c] = (codes[c] ?? 0) + 1
    onChange({ ...plantilla, grid, doubtful, codes })
  }

  return (
    <div className="view">
      <h2>Revisa lo leído</h2>
      <p className="hint">
        {Object.keys(plantilla.persons).length} personas. Toca una celda para corregirla. Las marcadas en amarillo ({doubtCount}) son dudosas: compruébalas con la foto.
        Recuerda que una celda vacía (·) es un diurno.
      </p>
      {plantilla.warnings.map((w) => (
        <p key={w} className="warn small">{w}</p>
      ))}
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={onlyDoubt} onChange={(e) => setOnlyDoubt(e.target.checked)} /> Solo filas con dudas
        </label>
        {images.length > 0 && (
          <button className="link" onClick={() => setShowImgs(!showImgs)}>{showImgs ? 'Ocultar fotos' : 'Ver fotos'}</button>
        )}
      </div>
      {showImgs && (
        <div className="photo-strip">
          {images.map((i) => (
            <RotatedPhoto key={i.id} img={i} />
          ))}
        </div>
      )}
      <div className="table-wrap">
        <table className="unit">
          <thead>
            <tr>
              <th className="sticky">Nombre</th>
              {dates.map((d) => (
                <th key={d} className={weekday(d) % 6 === 0 ? 'we' : ''}>
                  {WEEKDAY_LETTER[weekday(d)]}
                  <br />
                  {Number(d.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {persons.map((p) => (
              <tr key={p.id}>
                <th className="sticky">{p.name}</th>
                {dates.map((d) => {
                  const c = plantilla.grid[p.id]?.[d]
                  const doubt = plantilla.doubtful[`${p.id}|${d}`]
                  return (
                    <td
                      key={d}
                      className={`k-${c === undefined ? 'none' : state.legend[c] ? kindOf(state.legend, c) : 'ausencia'}${doubt ? ' doubt' : ''}`}
                      onClick={() => {
                        setEdit({ pid: p.id, date: d })
                        setDraft(c ?? '')
                      }}
                    >
                      {c === undefined ? '' : displayCode(c)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <button onClick={onBack}>Volver</button>
        <button className="primary" onClick={onAccept}>Continuar</button>
      </div>

      {edit && (
        <div className="sheet" onClick={() => setEdit(null)}>
          <div className="sheet-body" onClick={(e) => e.stopPropagation()}>
            <p>
              <b>{plantilla.persons[edit.pid]?.name}</b> · día {Number(edit.date.slice(8))}
            </p>
            <div className="row">
              {QUICK.map((q) => (
                <button
                  key={q || 'vacio'}
                  onClick={() => {
                    setCell(edit.pid, edit.date, q)
                    setEdit(null)
                  }}
                >
                  {q === '' ? '· diurno' : q}
                </button>
              ))}
            </div>
            <div className="row">
              <input id="codigo" value={draft} onChange={(e) => setDraft(e.target.value.trim())} placeholder="Otro código" />
              <button
                className="primary"
                onClick={() => {
                  setCell(edit.pid, edit.date, draft)
                  setEdit(null)
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
