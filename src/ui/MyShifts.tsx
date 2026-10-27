import { useMemo, useState } from 'react'
import { daysInMonth, fmtShort, isoDate, MONTHS, weekday } from '../domain/dates'
import { codeLabel } from '../domain/legend'
import { violations } from '../domain/rules'
import { clearManual, editCells, ensureMe } from '../domain/state'
import type { AppState } from '../domain/types'
import { CodeChip } from './common'

const QUICK: [string, string][] = [
  ['', 'Diurno'],
  ['N', 'Noche'],
  ['L', 'Libre'],
  ['D', 'Descanso'],
  ['Lh', 'Lh'],
  ['V', 'Vacaciones'],
  ['B', 'Baja'],
]

const CLEAR = '__borrar__'

// Mis propios turnos: corregir o meter días que la plantilla aún no recoge.
export function MyShifts({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const meId = state.meId
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [brush, setBrush] = useState<string | null>(null)
  const [other, setOther] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [edit, setEdit] = useState<string | null>(null)
  const [name, setName] = useState('')

  const [y, m] = month.split('-').map(Number)
  const days = useMemo(() => Array.from({ length: daysInMonth(y, m) }, (_, i) => isoDate(y, m, i + 1)), [y, m])

  const row = meId ? state.grid[meId] ?? {} : {}
  const origins = meId ? state.origins[meId] ?? {} : {}

  // Avisos de reglas duras en mis días de este mes (no impiden guardar).
  const warnings = useMemo(() => {
    if (!meId) return []
    return violations(row, state.legend, state.rules)
      .filter((v) => v.hard && v.key.split(':')[1]?.startsWith(month))
      .map((v) => v.message)
  }, [row, state.legend, state.rules, meId, month])

  if (!meId || !state.persons[meId]) {
    return (
      <div className="card">
        <h2>¿Quién eres?</h2>
        <p className="hint">
          Escribe tu nombre tal como aparecerá en la plantilla (APELLIDOS, NOMBRE). Si ya apareces, elígete en Ajustes → Yo. Cuando salgas en una plantilla, tus
          días se unirán solos.
        </p>
        <div className="row">
          <input id="mi-nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="APELLIDOS, NOMBRE" />
          <button className="primary" disabled={!name.includes(',')} onClick={() => setState(ensureMe(state, name))}>
            Guardar
          </button>
        </div>
      </div>
    )
  }

  const apply = (dates: string[], code: string) => {
    setState(code === CLEAR ? clearManual(state, meId, dates) : editCells(state, meId, dates, code))
  }

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1))
    setMonth(d.toISOString().slice(0, 7))
  }

  const brushLabel = brush === null ? '' : brush === CLEAR ? 'Borrar lo cambiado a mano' : codeLabel(state.legend, brush)
  const codes = Object.values(state.legend).sort((a, b) => a.code.localeCompare(b.code))

  return (
    <>
      <div className="card row between">
        <button aria-label="Mes anterior" onClick={() => shift(-1)}>‹</button>
        <b>
          {MONTHS[m - 1].toLowerCase()} {y}
        </b>
        <button aria-label="Mes siguiente" onClick={() => shift(1)}>›</button>
      </div>

      <div className="card">
        <p className="hint">
          Elige un turno y toca los días a los que aplicarlo. Sin turno elegido, toca un día para cambiarlo.
        </p>
        <div className="brushes">
          {QUICK.map(([code, label]) => (
            <button key={label} className={brush === code ? 'on' : ''} onClick={() => setBrush(brush === code ? null : code)}>
              <CodeChip code={code} legend={state.legend} small /> {label}
            </button>
          ))}
          <select
            id="otro-codigo"
            value={other}
            onChange={(e) => {
              const v = e.target.value
              setOther(v)
              setBrush(v === '' ? null : v === '(vacío)' ? '' : v)
            }}
          >
            <option value="">Otro…</option>
            {codes.map((c) => (
              <option key={c.code} value={c.code === '' ? '(vacío)' : c.code}>
                {c.code === '' ? '(vacío)' : c.code} — {c.name}
              </option>
            ))}
          </select>
          <button className={brush === CLEAR ? 'on danger' : 'danger'} onClick={() => setBrush(brush === CLEAR ? null : CLEAR)}>
            Borrar
          </button>
        </div>
        {brush !== null && (
          <>
            <p className="ok">Tocando días: {brushLabel}</p>
            <div className="row">
              <span>Del día</span>
              <input id="desde" className="num" type="number" min={1} max={days.length} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
              <span>al</span>
              <input id="hasta" className="num" type="number" min={1} max={days.length} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
              <button
                disabled={!range.from || !range.to || Number(range.from) > Number(range.to)}
                onClick={() => {
                  const from = Math.max(1, Number(range.from))
                  const to = Math.min(days.length, Number(range.to))
                  apply(days.slice(from - 1, to), brush)
                  setRange({ from: '', to: '' })
                }}
              >
                Aplicar
              </button>
            </div>
          </>
        )}
      </div>

      <div className="month">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l) => (
          <div key={l} className="mh">{l}</div>
        ))}
        {Array.from({ length: (weekday(days[0]) + 6) % 7 }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {days.map((d) => {
          const o = origins[d]?.origin
          return (
            <button
              key={d}
              className={`mday o-${o ?? 'oficial'}`}
              aria-label={`Día ${Number(d.slice(8))}`}
              onClick={() => (brush !== null ? apply([d], brush) : setEdit(d))}
            >
              <span>
                {Number(d.slice(8))}
                {o === 'manual' && <i className="dot" />}
              </span>
              <CodeChip code={row[d]} legend={state.legend} small />
            </button>
          )
        })}
      </div>
      <p className="hint legend-line">
        Borde discontinuo con punto: cambiado a mano. Sin punto: cambio registrado. "–": sin dato.
      </p>
      {warnings.map((w) => (
        <p key={w} className="warn">Aviso: {w}</p>
      ))}

      {edit && (
        <div className="sheet" onClick={() => setEdit(null)}>
          <div className="sheet-body" onClick={(e) => e.stopPropagation()}>
            <p>
              <b>{fmtShort(edit)}</b> · ahora: {codeLabel(state.legend, row[edit])}
              {origins[edit]?.origin === 'manual' && ' (cambiado a mano)'}
            </p>
            <div className="brushes">
              {QUICK.map(([code, label]) => (
                <button
                  key={label}
                  onClick={() => {
                    apply([edit], code)
                    setEdit(null)
                  }}
                >
                  <CodeChip code={code} legend={state.legend} small /> {label}
                </button>
              ))}
            </div>
            <label className="field">
              <span>Otro código</span>
              <select
                id="otro-dia"
                value=""
                onChange={(e) => {
                  apply([edit], e.target.value === '(vacío)' ? '' : e.target.value)
                  setEdit(null)
                }}
              >
                <option value="">Elegir…</option>
                {codes.map((c) => (
                  <option key={c.code} value={c.code === '' ? '(vacío)' : c.code}>
                    {c.code === '' ? '(vacío)' : c.code} — {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="row">
              {origins[edit]?.origin === 'manual' && (
                <button
                  className="danger"
                  onClick={() => {
                    apply([edit], CLEAR)
                    setEdit(null)
                  }}
                >
                  Volver al de la plantilla
                </button>
              )}
              <button onClick={() => setEdit(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
