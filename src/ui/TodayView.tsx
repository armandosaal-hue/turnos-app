import { useMemo, useState } from 'react'
import { addDays, daysInMonth, defaultDate, isoDate, MONTHS, todayIso, weekday, WEEKDAY_SHORT } from '../domain/dates'
import { allDates } from '../domain/engine'
import { coworkers, monthSummary } from '../domain/summary'
import { visualKind, type VisualKind } from '../domain/legend'
import type { AppState } from '../domain/types'
import { Empty, shortName, ShiftPill } from './common'
import { Icon, type IconName } from './icons'
import type { MoreSection } from './MoreView'

const WEEKDAY_FULL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const LOOK: Record<VisualKind, { icon: IconName; label: string }> = {
  diurno: { icon: 'sun', label: 'Diurno' },
  noche: { icon: 'moon', label: 'Noche' },
  saliente: { icon: 'bed', label: 'Saliente de noche' },
  libre: { icon: 'leaf', label: 'Libre' },
  ocupado: { icon: 'briefcase', label: 'Trabajas' },
  ausencia: { icon: 'ban', label: 'No disponible' },
  none: { icon: 'calendar', label: 'Sin datos' },
}

export function TodayView({
  state,
  openDay,
  goMyShifts,
  goMore,
}: {
  state: AppState
  openDay: (date: string) => void
  goMyShifts: () => void
  goMore: (s: MoreSection) => void
}) {
  const dates = useMemo(() => allDates(state.grid), [state.grid])
  const today = todayIso()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [allCo, setAllCo] = useState(false)
  const meId = state.meId
  const me = (meId && state.grid[meId]) || {}

  if (!dates.length && !Object.keys(me).length) {
    return (
      <Empty icon="upload">
        <p>Todavía no hay turnos. Carga la plantilla de la unidad o una captura de tu app de turnos.</p>
        <button className="primary" onClick={() => goMore('cargar')}>Cargar plantilla</button>
        <button onClick={() => goMore('myshot')}>Captura de mi app</button>
      </Empty>
    )
  }
  if (!meId || !state.persons[meId]) {
    return (
      <Empty icon="user">
        <p>Dime quién eres para ver tus turnos y pedir cambios.</p>
        <button className="primary" onClick={() => goMore('yo')}>Elegir quién soy</button>
      </Empty>
    )
  }

  const vk = (d: string) => visualKind(state.legend, me[d], me[addDays(d, -1)], state.rules.restAfterNight.nightCode, state.rules.restAfterNight.restCode)
  const code = me[today]
  const kind = vk(today)
  const entry = code !== undefined ? state.legend[code] : undefined
  const look = LOOK[kind]
  const label = kind === 'ocupado' || kind === 'ausencia' ? entry?.name ?? look.label : look.label
  const hours = entry?.start && entry?.end ? `${entry.start} – ${entry.end}` : kind === 'saliente' ? 'Descanso tras la noche' : ''
  const [, m, d] = today.split('-').map(Number)

  const nextShift = Array.from({ length: 60 }, (_, i) => addDays(today, i + 1)).find((x) => ['diurno', 'noche'].includes(vk(x)))
  const thisMonth = today.slice(0, 7)
  const monthShifts = Object.keys(me).filter((x) => x.startsWith(thisMonth) && ['diurno', 'noche'].includes(vk(x))).length
  const loadedInMonth = dates.filter((x) => x.startsWith(thisMonth))
  const known = loadedInMonth.filter((x) => me[x] !== undefined).length
  const missing = loadedInMonth.length > 0 && known < loadedInMonth.length

  const canOpen = (x: string) => dates.includes(x)
  const hoursOf = (x: string) => {
    const e = state.legend[me[x]]
    return e?.start && e?.end ? `${e.start}–${e.end}` : ''
  }
  const [yy, my] = month.split('-').map(Number)
  const monthDays = Array.from({ length: daysInMonth(yy, my) }, (_, i) => isoDate(yy, my, i + 1))
  const sum = monthSummary(state, meId, month)
  const team = nextShift ? coworkers(state, meId, nextShift) : []

  return (
    <div className="view">
      <div className={`card today v-${kind}`}>
        <div className="today-top">
          <div>
            <div className="today-label">
              Hoy · {WEEKDAY_FULL[weekday(today)]} {d} de {MONTHS[m - 1].toLowerCase()}
            </div>
            <div className="today-shift">{label}</div>
            {hours && <div className="today-hours">{hours}</div>}
          </div>
          <span className="today-ico">
            <Icon name={look.icon} size={34} />
          </span>
        </div>
      </div>

      <button className="primary big" onClick={() => openDay(canOpen(today) ? today : defaultDate(dates))}>
        <Icon name="swap" /> Pedir un cambio
      </button>

      {missing && (
        <div className="notice">
          <p>
            Faltan tus turnos de {loadedInMonth.length - known} días de este mes: las devoluciones solo se buscan en días en que sé lo que tienes.
          </p>
          <div className="row">
            <button onClick={() => goMore('myshot')}>
              <Icon name="image" size={18} /> Subir captura
            </button>
            <button onClick={goMyShifts}>
              <Icon name="brush" size={18} /> Meterlos a mano
            </button>
          </div>
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <span>Próximo turno</span>
          <b>{nextShift ? Number(nextShift.slice(8)) : '–'}</b>
          <span>
            {nextShift
              ? `${WEEKDAY_SHORT[weekday(nextShift)]} · ${LOOK[vk(nextShift)].label.toLowerCase()}${hoursOf(nextShift) ? ` · ${hoursOf(nextShift)}` : ''}`
              : 'sin turnos cargados'}
          </span>
        </div>
        <div className="stat">
          <span>Turnos de 12 h este mes</span>
          <b>{monthShifts}</b>
          <span>{MONTHS[m - 1].toLowerCase()}</span>
        </div>
      </div>

      <div className="card">
        <div className="month-nav">
          <button aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
            <Icon name="left" size={18} />
          </button>
          <b>
            {MONTHS[my - 1].toLowerCase()} {yy}
          </b>
          <button aria-label="Mes siguiente" onClick={() => setMonth(shiftMonth(month, 1))}>
            <Icon name="right" size={18} />
          </button>
        </div>
        {sum.known === 0 ? (
          <p className="hint">No tengo tus turnos de este mes.</p>
        ) : (
          <div className="summary-grid">
            <div className="sg p-diurno-soft">
              <b>{sum.diurnos}</b>
              <span>diurnos</span>
            </div>
            <div className="sg p-noche-soft">
              <b>{sum.noches}</b>
              <span>noches</span>
            </div>
            <div className="sg">
              <b>{sum.hours}</b>
              <span>horas</span>
            </div>
            <div className="sg">
              <b>{sum.libres}</b>
              <span>libres</span>
            </div>
            <div className="sg">
              <b>{sum.weekendDays}</b>
              <span>sáb/dom</span>
            </div>
          </div>
        )}
        {sum.known > 0 && sum.known < sum.days && <p className="hint">Faltan {sum.days - sum.known} días tuyos de este mes en la app.</p>}
        <div className="month mine">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l) => (
            <div key={l} className="mh">{l}</div>
          ))}
          {Array.from({ length: (weekday(monthDays[0]) + 6) % 7 }, (_, i) => (
            <div key={`e${i}`} />
          ))}
          {monthDays.map((x) => (
            <button
              key={x}
              className={`mday${x === today ? ' is-today' : ''}`}
              disabled={!canOpen(x)}
              onClick={() => openDay(x)}
              aria-label={`Día ${Number(x.slice(8))}`}
            >
              <span>{Number(x.slice(8))}</span>
              <ShiftPill code={me[x]} prev={me[addDays(x, -1)]} legend={state.legend} />
            </button>
          ))}
        </div>
        <p className="hint">Toca un día para pedir un cambio.</p>
      </div>

      {nextShift && (
        <div className="card">
          <h2>Quién trabaja contigo</h2>
          <p className="hint">
            {WEEKDAY_FULL[weekday(nextShift)]} {Number(nextShift.slice(8))} · {LOOK[vk(nextShift)].label.toLowerCase()} · {team.length}{' '}
            {team.length === 1 ? 'compañero' : 'compañeros'} según la plantilla cargada (puede no estar actualizada).
          </p>
          <ul className="team">
            {(allCo ? team : team.slice(0, 8)).map((p) => (
              <li key={p.id}>
                <span className="group-dot" style={{ background: p.group ?? 'var(--line)' }} />
                {p.puesto && <span className="num-badge">{p.puesto}</span>}
                <span>{shortName(p)}</span>
              </li>
            ))}
          </ul>
          {team.length > 8 && (
            <button className="link" onClick={() => setAllCo(!allCo)}>
              {allCo ? 'Ver menos' : `Ver todos (${team.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}
