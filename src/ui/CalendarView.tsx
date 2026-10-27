import { useMemo, useState } from 'react'
import { allDates } from '../domain/engine'
import { codeLabel, displayCode } from '../domain/legend'
import { fmtShort, MONTHS, weekday, WEEKDAY_LETTER } from '../domain/dates'
import { editCell } from '../domain/state'
import type { AppState } from '../domain/types'
import { normalize } from './common'
import { MyShifts } from './MyShifts'

export function CalendarView({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const dates = useMemo(() => allDates(state.grid), [state.grid])
  const months = useMemo(() => [...new Set(dates.map((d) => d.slice(0, 7)))], [dates])
  const thisMonth = new Date().toISOString().slice(0, 7)
  const [month, setMonth] = useState(() => (months.includes(thisMonth) ? thisMonth : months[0]))
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
      {mode === 'unidad' && !dates.length && <div className="empty">Primero carga una plantilla en la pestaña <b>Cargar</b>.</div>}
      {mode === 'unidad' && dates.length > 0 && (
        <div className="card row between">
          <button disabled={idx <= 0} onClick={() => setMonth(months[idx - 1])}>‹</button>
          <b>
            {MONTHS[m - 1]?.toLowerCase()} {y}
          </b>
          <button disabled={idx >= months.length - 1} onClick={() => setMonth(months[idx + 1])}>›</button>
        </div>
      )}

      {mode === 'unidad' && dates.length > 0 && (
        <>
          <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nombre…" />
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
                      <th className="sticky">{p.name}</th>
                      {monthDates.map((d) => (
                        <td
                          key={d}
                          className={`k-${state.grid[p.id]?.[d] === undefined ? 'none' : state.legend[state.grid[p.id][d]]?.kind ?? 'ausencia'} o-${origin(p.id, d) ?? 'oficial'}`}
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
      <p className="hint legend-line">
        <span className="chip k-trabajo sm">·</span> diurno 12 h · <span className="chip k-trabajo sm">N</span> noche ·{' '}
        <span className="chip k-libre sm">L</span> libre · <span className="chip k-ocupado sm">M</span> trabaja 7 h ·{' '}
        <span className="chip k-ausencia sm">B</span> no disponible · borde discontinuo: cambio o edición tuya
      </p>

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
