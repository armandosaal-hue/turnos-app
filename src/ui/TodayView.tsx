import { useMemo } from 'react'
import { addDays, defaultDate, fmtShort, MONTHS, todayIso, weekday, WEEKDAY_SHORT } from '../domain/dates'
import { allDates, balanceWith } from '../domain/engine'
import { visualKind, type VisualKind } from '../domain/legend'
import type { AppState } from '../domain/types'
import { CodeChip, Empty } from './common'
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
  goCambios,
  goMyShifts,
  goMore,
}: {
  state: AppState
  openDay: (date: string) => void
  goCambios: () => void
  goMyShifts: () => void
  goMore: (s: MoreSection) => void
}) {
  const dates = useMemo(() => allDates(state.grid), [state.grid])
  const today = todayIso()
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

  const next = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1))
  const nextShift = Array.from({ length: 60 }, (_, i) => addDays(today, i + 1)).find((x) => ['diurno', 'noche'].includes(vk(x)))
  const month = today.slice(0, 7)
  const monthShifts = Object.keys(me).filter((x) => x.startsWith(month) && ['diurno', 'noche'].includes(vk(x))).length
  const loadedInMonth = dates.filter((x) => x.startsWith(month))
  const known = loadedInMonth.filter((x) => me[x] !== undefined).length
  const missing = loadedInMonth.length > 0 && known < loadedInMonth.length

  const partners = [...new Set(state.cambios.map((c) => c.partnerId))]
  let owed = 0
  let owe = 0
  for (const p of partners) {
    const b = balanceWith(state.cambios, p)
    if (b > 0) owed += b
    else owe -= b
  }
  const pending = state.cambios.filter((c) => c.status === 'pendiente').length
  const canOpen = (x: string) => dates.includes(x)

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

      <p className="section-title">Próximos días</p>
      <div className="week">
        {next.map((x) => (
          <button key={x} className="wday" disabled={!canOpen(x)} onClick={() => openDay(x)} aria-label={`Cambiar el ${fmtShort(x)}`}>
            <span className="wd-l">{WEEKDAY_SHORT[weekday(x)]}</span>
            <span className="wd-n">{Number(x.slice(8))}</span>
            <CodeChip code={me[x]} prev={me[addDays(x, -1)]} legend={state.legend} small />
          </button>
        ))}
      </div>

      <div className="stats">
        <div className="stat">
          <span>Próximo turno</span>
          <b>{nextShift ? Number(nextShift.slice(8)) : '–'}</b>
          <span>{nextShift ? `${WEEKDAY_SHORT[weekday(nextShift)]} · ${LOOK[vk(nextShift)].label.toLowerCase()}` : 'sin turnos cargados'}</span>
        </div>
        <div className="stat">
          <span>Turnos de 12 h este mes</span>
          <b>{monthShifts}</b>
          <span>{MONTHS[m - 1].toLowerCase()}</span>
        </div>
        <button className="stat" onClick={goCambios}>
          <span>Saldo de cambios</span>
          <b className={owed - owe > 0 ? 'ok' : owed - owe < 0 ? 'warn' : ''}>{owed - owe > 0 ? `+${owed - owe}` : owed - owe}</b>
          <span>{owed || owe ? `te deben ${owed} · debes ${owe}` : 'nadie te debe ni debes'}</span>
        </button>
        <button className="stat" onClick={goCambios}>
          <span>Cambios pendientes</span>
          <b>{pending}</b>
          <span>sin confirmar en la plantilla</span>
        </button>
      </div>
    </div>
  )
}
