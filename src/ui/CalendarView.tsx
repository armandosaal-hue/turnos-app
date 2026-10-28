import { useMemo, useState } from 'react'
import { allDates } from '../domain/engine'
import { codeLabel, displayCode, visualKind } from '../domain/legend'
import { addDays, defaultDate, fmtShort, MONTHS, todayIso, weekday, WEEKDAY_LETTER } from '../domain/dates'
import { editCell } from '../domain/state'
import type { AppState } from '../domain/types'
import { Empty, normalize } from './common'
import { MyShifts } from './MyShifts'
import { Icon } from './icons'

export function CalendarView({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const dates = useMemo(() => allDates(state.grid), [state.grid])
  const months = useMemo(() => [...new Set(dates.map((d) => d.slice(0, 7)))], [dates])
  const [month, setMonth] = useState(() => defaultDate(months, todayIso().slice(0, 7)))
  const [mode, setMode] = useState<'yo' | 'unidad'>('yo')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<{ personId: string; date: string } | null>(null)

  const monthDates = dates.filter((d) => d.startsWith(month ?? ''))
  const meId = state.meId
  const idx = months.indexOf(month)
  const [y, m] = (month ?? '').split('-').map(Number)

  const origin = (pid: string, d: string) => state.origins[pid]?.[d]?.origin

  return (
    <div className="view">
      <div className="seg">
        <button className={mode === 'yo' ? 'on' : ''} onClick={() => setMode('yo')}>Mis turnos</button>
        <button className={mode === 'unidad' ? 'on' : ''} onClick={() => setMode('unidad')}>Unidad</button>
      </div>
      {mode === 'yo' && <MyShifts state={state} setState={setState} />}
      {mode === 'unidad' && !dates.length && (
        <Empty icon="upload">
          <p>Primero carga una plantilla en Más → Cargar plantilla.</p>
        </Empty>
      )}
      {mode === 'unidad' && dates.length > 0 && (
        <div className="card month-nav">
          <button aria-label="Mes anterior" disabled={idx <= 0} onClick={() => setMonth(months[idx - 1])}>
            <Icon name="left" size={18} />
          </button>
          <b>
            {MONTHS[m - 1]?.toLowerCase()} {y}
          </b>
          <button aria-label="Mes siguiente" disabled={idx >= months.length - 1} onClick={() => setMonth(months[idx + 1])}>
            <Icon name="right" size={18} />
          </button>
        </div>
      )}

      {mode === 'unidad' && dates.length > 0 && (
        <>
          <div className="search-box">
            <Icon name="search" size={18} />
            <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nombre…" />
          </div>
          <div className="table-wrap">
            <table className="unit">
              <thead>
                <tr>
                  <th className="sticky">Nombre</th>
                  {monthDates.map((d) => (
                    <th key={d} className={weekday(d) % 6 === 0 ? 'we' : ''}>
                      {WEEKDAY_LETTER[weekday(d)]}
                      <br />
                      {Number(d.slice(8))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.values(state.persons)
                  .filter((p) => !q || normalize(p.name).includes(normalize(q)))
                  .sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : a.name.localeCompare(b.name)))
                  .map((p) => (
                    <tr key={p.id} className={p.id === meId ? 'me' : ''}>
                      <th className={`sticky${p.group ? ' g' : ''}`} style={p.group ? ({ '--g': p.group } as React.CSSProperties) : undefined}>
                        <span className="nm">
                          {p.puesto && <span className="nm-n">{p.puesto}</span>}
                          <span className="nm-s">{p.name.split(',')[0].trim() || p.note}</span>
                          {p.name.includes(',') && <span className="nm-g">{p.name.split(',').slice(1).join(',').trim()}</span>}
                        </span>
                      </th>
                      {monthDates.map((d) => (
                        <td
                          key={d}
                          className={`v-${visualKind(state.legend, state.grid[p.id]?.[d], state.grid[p.id]?.[addDays(d, -1)])} o-${origin(p.id, d) ?? 'oficial'}`}
                          onClick={() => state.grid[p.id]?.[d] !== undefined && setEdit({ personId: p.id, date: d })}
                        >
                          {state.grid[p.id]?.[d] === undefined ? '' : displayCode(state.grid[p.id][d])}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="hint legend-line">
        <span><span className="chip v-diurno sm">☼</span>diurno</span>
        <span><span className="chip v-noche sm">N</span>noche</span>
        <span><span className="chip v-saliente sm">D</span>saliente</span>
        <span><span className="chip v-libre sm">L</span>libre</span>
        <span><span className="chip v-ocupado sm">M</span>7 h</span>
        <span><span className="chip v-ausencia sm">B</span>no disponible</span>
        <span>borde discontinuo: cambio o edición tuya</span>
      </div>

      {edit && (
        <div className="sheet" onClick={() => setEdit(null)}>
          <div className="sheet-body" onClick={(e) => e.stopPropagation()}>
            <p>
              <b>{state.persons[edit.personId]?.name}</b> · {fmtShort(edit.date)}
            </p>
            <p>Ahora: {codeLabel(state.legend, state.grid[edit.personId]?.[edit.date])}</p>
            <label className="field">
              <span>Cambiar a mano</span>
              <select
                value={state.grid[edit.personId]?.[edit.date] ?? ''}
                onChange={(e) => {
                  setState(editCell(state, edit.personId, edit.date, e.target.value))
                  setEdit(null)
                }}
              >
                {Object.values(state.legend)
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code === '' ? '(vacío)' : c.code} — {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <p className="hint">La edición queda marcada como manual hasta que una plantilla oficial la confirme.</p>
            <button onClick={() => setEdit(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
