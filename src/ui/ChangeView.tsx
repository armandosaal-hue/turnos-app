import { useEffect, useMemo, useRef, useState } from 'react'
import { allDates, recommend, recommendShiftSwap, type Candidate, type ReturnOption } from '../domain/engine'
import { codeLabel, visualKind } from '../domain/legend'
import { addDays, defaultDate, fmtShort, MONTHS, weekday, WEEKDAY_SHORT } from '../domain/dates'
import { groupCandidates, type GroupInfo } from '../domain/groups'
import { registerCambio } from '../domain/state'
import type { AppState, CambioType, Legend, Person } from '../domain/types'
import { Avatar, CodeChip, Empty, shortName } from './common'
import { Icon } from './icons'

// Lo que se elige en Cambiar. Vive en App para que no se pierda al cambiar de pestaña.
export interface ChangeUi {
  date?: string
  preferredReturn?: string
  onlyWithReturn: boolean
  byGroup?: boolean // por grupos de color (por defecto sí)
  mode?: 'turno' // cambiar diurno por noche (o al revés) el mismo día
  open: string[] // candidatos desplegados
}

export const emptyChangeUi: ChangeUi = { onlyWithReturn: false, open: [] }

export function ChangeView({
  state,
  setState,
  goSettings,
  goMyShifts,
  goLoad,
  ui,
  setUi,
}: {
  state: AppState
  setState: (s: AppState) => void
  goSettings: () => void
  goMyShifts: () => void
  goLoad: () => void
  ui: ChangeUi
  setUi: (u: ChangeUi) => void
}) {
  const dates = useMemo(() => allDates(state.grid), [state.grid])
  const date = ui.date && dates.includes(ui.date) ? ui.date : defaultDate(dates)
  const { onlyWithReturn, preferredReturn } = ui
  const [showDiscarded, setShowDiscarded] = useState(false)
  const [showNotValid, setShowNotValid] = useState(false)
  const [pickReturn, setPickReturn] = useState(false)
  const [pending, setPending] = useState<{ c: Candidate; returnDate?: string } | null>(null)

  const meId = state.meId
  const myShift = meId ? visualKind(state.legend, state.grid[meId]?.[date]) : 'none'
  const swapMode = ui.mode === 'turno' && (myShift === 'diurno' || myShift === 'noche')
  const rec = useMemo(
    () =>
      meId && dates.length ? (swapMode ? recommendShiftSwap(state, meId, date) : recommend(state, meId, date, { preferredReturn })) : null,
    [state, meId, date, dates.length, preferredReturn, swapMode],
  )
  const setDate = (d: string) => setUi({ ...ui, date: d, preferredReturn: undefined, open: [] })
  const toggleOpen = (id: string) =>
    setUi({ ...ui, open: ui.open.includes(id) ? ui.open.filter((x) => x !== id) : [...ui.open, id] })

  if (!dates.length)
    return (
      <Empty icon="upload">
        <p>Primero carga una plantilla.</p>
        <button className="primary" onClick={goLoad}>Cargar plantilla</button>
      </Empty>
    )
  if (!meId || !state.persons[meId])
    return (
      <Empty icon="user">
        <p>Indica quién eres. Si todavía no apareces en la plantilla, escribe tu nombre.</p>
        <button className="primary" onClick={goSettings}>Elegir quién soy</button>
      </Empty>
    )

  const me = state.grid[meId] ?? {}
  const myCode = me[date]
  // Las devoluciones solo se buscan en días en que la app conoce mi turno.
  const month = date.slice(0, 7)
  const loadedInMonth = dates.filter((d) => d.startsWith(month))
  const knownInMonth = loadedInMonth.filter((d) => me[d] !== undefined).length
  const missingMine = loadedInMonth.length > 0 && knownInMonth < loadedInMonth.length
  // En el cambio de turno del mismo día no hay devoluciones: esos filtros no se aplican.
  const all = rec ? rec.candidates.filter((c) => swapMode || !onlyWithReturn || c.returns.length) : []
  const fits = (c: Candidate) => !!c.preferred && 'option' in c.preferred
  const usePreferred = !!preferredReturn && !swapMode
  const list = usePreferred ? all.filter(fits) : all
  const notValid = usePreferred ? all.filter((c) => !fits(c)) : []
  const hasGroups = list.some((c) => state.persons[c.personId]?.group)
  const groups = hasGroups && ui.byGroup !== false && !swapMode ? groupCandidates(state, list) : null
  const ordered = groups ? groups.flatMap((g) => g.candidates) : list
  const rankOf = new Map(ordered.map((c, i) => [c.personId, i + 1]))
  const reasons = new Set(notValid.map((c) => (c.preferred && 'reason' in c.preferred ? c.preferred.reason : '')))
  const commonReason = !list.length && notValid.length > 1 && reasons.size === 1 ? [...reasons][0] : ''
  const vk = visualKind(state.legend, myCode, me[addDays(date, -1)])
  const shiftName = vk === 'noche' ? 'la noche' : vk === 'diurno' ? 'el diurno' : 'el turno'

  return (
    <div className="view">
      <div className="card">
        <DayStrip dates={dates} value={date} onChange={setDate} row={me} legend={state.legend} />
        <label className="field">
          <span>Otra fecha</span>
          <input type="date" value={date} min={dates[0]} max={dates[dates.length - 1]} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </div>

      <div className="card">
        <div className="summary">
          <span className={`summary-ico v-${vk}`}>
            <Icon name={vk === 'noche' ? 'moon' : vk === 'diurno' ? 'sun' : rec?.type === 'trabajar' ? 'briefcase' : 'calendar'} size={24} />
          </span>
          <div>
            <b>
              {rec?.type === 'turno'
                ? vk === 'diurno'
                  ? 'Cambiar mi diurno por una noche'
                  : 'Cambiar mi noche por un diurno'
                : rec?.type === 'quitar'
                  ? `Quitarme ${shiftName}`
                  : rec?.type === 'trabajar'
                    ? 'Ponerme a trabajar'
                    : fmtShort(date)}
            </b>
            <div className="hint">
              {fmtShort(date)} · tienes {codeLabel(state.legend, myCode)}
            </div>
          </div>
        </div>
        {(myShift === 'diurno' || myShift === 'noche') && (
          <div className="seg">
            <button className={!swapMode ? 'on' : ''} onClick={() => setUi({ ...ui, mode: undefined, open: [] })}>
              Quitarme el turno
            </button>
            <button className={swapMode ? 'on' : ''} onClick={() => setUi({ ...ui, mode: 'turno', preferredReturn: undefined, open: [] })}>
              {myShift === 'diurno' ? 'Cambiar a noche' : 'Cambiar a diurno'}
            </button>
          </div>
        )}
        {rec?.error && <p className="warn">{rec.error}</p>}
        {swapMode && (
          <p className="hint">
            Compañeros que ese día tienen {myShift === 'diurno' ? 'noche' : 'diurno'} y pueden cambiártelo sin romper las reglas. Es el mismo día, así que no hace
            falta devolución.
          </p>
        )}
        {!swapMode && missingMine && (
          <div className="notice">
            <p>
              Solo tengo <b>{knownInMonth} de {loadedInMonth.length}</b> días tuyos de este mes
              {state.persons[meId]?.puesto ? '' : ' (no apareces en la plantilla)'}. Las devoluciones solo se buscan en días en que sé que libras.
            </p>
            <button onClick={goMyShifts}>
              <Icon name="brush" size={18} /> Meter mis turnos
            </button>
          </div>
        )}
        {rec?.type && !swapMode && (
          <div className="filters">
            <button className={`pill${onlyWithReturn ? ' on' : ''}`} aria-pressed={onlyWithReturn} onClick={() => setUi({ ...ui, onlyWithReturn: !onlyWithReturn })}>
              {onlyWithReturn && <Icon name="check" size={16} />} Con devolución
            </button>
            {all.some((c) => state.persons[c.personId]?.group) && (
              <button className={`pill${ui.byGroup !== false ? ' on' : ''}`} aria-pressed={ui.byGroup !== false} onClick={() => setUi({ ...ui, byGroup: ui.byGroup === false })}>
                {ui.byGroup !== false && <Icon name="check" size={16} />} Por grupos
              </button>
            )}
            {preferredReturn ? (
              <button className="pill on" onClick={() => setUi({ ...ui, preferredReturn: undefined })} aria-label="Quitar fecha de devolución">
                Devolver el {fmtShort(preferredReturn)} ✕
              </button>
            ) : (
              <button className={`pill${pickReturn ? ' on' : ''}`} onClick={() => setPickReturn(!pickReturn)}>
                <Icon name="calendar" size={16} /> Devolver el día…
              </button>
            )}
          </div>
        )}
        {rec?.type && !swapMode && (pickReturn || preferredReturn) && (
          <div className="return-pick">
            <p className="hint">¿Qué día propones para la devolución?</p>
            <DayStrip
              dates={dates}
              value={preferredReturn}
              onChange={(d) => {
                setUi({ ...ui, preferredReturn: d })
                setPickReturn(false)
              }}
              row={me}
              legend={state.legend}
              start={preferredReturn ?? date}
            />
            <label className="field">
              <span>Otra fecha de devolución</span>
              <input
                id="devolver"
                type="date"
                value={preferredReturn ?? ''}
                min={dates[0]}
                max={dates[dates.length - 1]}
                onChange={(e) => setUi({ ...ui, preferredReturn: e.target.value || undefined })}
              />
            </label>
          </div>
        )}
      </div>

      {rec?.type && (
        <>
          <h2>
            {list.length} {list.length === 1 ? 'candidato' : 'candidatos'}
            {usePreferred && ` con devolución el ${fmtShort(preferredReturn)}`}
          </h2>
          {commonReason && <p className="warn">Nadie vale para ese día: {commonReason}.</p>}
          {swapMode && !list.length && (
            <p className="warn">
              {rec.discarded.length
                ? `Los ${rec.discarded.length} compañeros con ${myShift === 'diurno' ? 'noche' : 'diurno'} ese día quedan descartados por las reglas. Mira el motivo en "Ver descartados".`
                : `Ese día nadie de la plantilla tiene ${myShift === 'diurno' ? 'noche' : 'diurno'} que pueda cambiarte.`}
            </p>
          )}
          {groups && <p className="hint">Por grupo de color de la plantilla: primero los grupos a los que el turno se les junta con su ciclo de turnos.</p>}
          {list.length > 0 && !Object.values(state.persons).some((p) => p.group) && (
            <p className="hint">Para verlos por grupos de color, vuelve a cargar el Excel en Más → Cargar plantilla.</p>
          )}
          {(groups ?? [{ key: 'all', candidates: list } as Pick<GroupInfo, 'key' | 'candidates'> & Partial<GroupInfo>]).map((g) => (
            <section key={g.key}>
              {groups && (
                <div className="group-head">
                  <span className="group-dot" style={{ background: g.color ?? 'var(--line)' }} />
                  <div>
                    <b>
                      {g.name}
                      {g.range && <small> · {g.range}</small>}
                    </b>
                    <div className="hint">
                      {g.candidates.length} {g.candidates.length === 1 ? 'candidato' : 'candidatos'} · {g.note}
                    </div>
                  </div>
                </div>
              )}
              {g.candidates.map((c) => (
            <CandidateCard
              key={c.personId}
              rank={rankOf.get(c.personId)!}
              c={c}
              state={state}
              type={rec.type!}
              onRegister={(c, returnDate) => setPending({ c, returnDate })}
              missingMine={missingMine}
              open={ui.open.includes(c.personId)}
              onToggle={() => toggleOpen(c.personId)}
            />
              ))}
            </section>
          ))}
          {usePreferred && notValid.length > 0 && (
            <div className="card">
              <button className="link" onClick={() => setShowNotValid(!showNotValid)}>
                {showNotValid ? 'Ocultar' : 'Ver'} los que no valen para el {fmtShort(preferredReturn)} ({notValid.length})
              </button>
              {showNotValid && (
                <ul className="discarded">
                  {notValid.map((c) => (
                    <li key={c.personId}>
                      <b>{label(state.persons[c.personId])}</b>: {c.preferred && 'reason' in c.preferred ? c.preferred.reason : ''}
                      {c.returns.length > 0 && ` · otras devoluciones: ${c.returns.slice(0, 3).map((r) => fmtShort(r.date)).join(', ')}`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="card">
            <button className="link" onClick={() => setShowDiscarded(!showDiscarded)}>
              {showDiscarded ? 'Ocultar' : 'Ver'} descartados ({rec.discarded.length})
            </button>
            {showDiscarded && (
              <ul className="discarded">
                {rec.discarded.map((d) => (
                  <li key={d.personId}>
                    <b>{label(state.persons[d.personId])}</b>: {d.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {pending && (
            <ConfirmSheet
              state={state}
              type={rec.type}
              date={date}
              meId={meId}
              c={pending.c}
              returnDate={pending.returnDate}
              onCancel={() => setPending(null)}
              onConfirm={() => {
                setState(registerCambio(state, meId, rec.type!, date, pending.c.personId, pending.returnDate))
                setPending(null)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

// Nombre corto con el número que tiene asignado en la plantilla (columna A).
function label(p: Person | undefined): string {
  return p?.puesto ? `${p.puesto} · ${shortName(p)}` : shortName(p)
}

// Tira de días de un mes con el color de mi turno, y flechas para cambiar de mes.
function DayStrip({
  dates,
  value,
  onChange,
  row,
  legend,
  start,
}: {
  dates: string[]
  value?: string
  onChange: (d: string) => void
  row: Record<string, string>
  legend: Legend
  start?: string
}) {
  const months = useMemo(() => [...new Set(dates.map((d) => d.slice(0, 7)))], [dates])
  const [month, setMonth] = useState(() => (start ?? value ?? dates[0]).slice(0, 7))
  useEffect(() => {
    if (value) setMonth(value.slice(0, 7))
  }, [value])
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('.sel, .today-mark')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [month, value])
  const idx = months.indexOf(month)
  const [y, m] = month.split('-').map(Number)
  const days = dates.filter((d) => d.startsWith(month))
  return (
    <>
      <div className="month-nav">
        <button aria-label="Mes anterior" disabled={idx <= 0} onClick={() => setMonth(months[idx - 1])}>
          <Icon name="left" size={18} />
        </button>
        <b>
          {MONTHS[m - 1]?.toLowerCase()} {y}
        </b>
        <button aria-label="Mes siguiente" disabled={idx < 0 || idx >= months.length - 1} onClick={() => setMonth(months[idx + 1])}>
          <Icon name="right" size={18} />
        </button>
      </div>
      <div className="week" ref={ref}>
        {days.map((d) => (
          <button key={d} className={`wday${d === value ? ' sel' : ''}`} onClick={() => onChange(d)} aria-label={`Día ${fmtShort(d)}`}>
            <span className="wd-l">{WEEKDAY_SHORT[weekday(d)]}</span>
            <span className="wd-n">{Number(d.slice(8))}</span>
            <CodeChip code={row[d]} prev={row[addDays(d, -1)]} legend={legend} small />
          </button>
        ))}
      </div>
    </>
  )
}

function CandidateCard({
  rank,
  c,
  state,
  type,
  onRegister,
  missingMine,
  open,
  onToggle,
}: {
  rank: number
  c: Candidate
  state: AppState
  type: CambioType
  onRegister: (c: Candidate, returnDate?: string) => void
  missingMine: boolean
  open: boolean
  onToggle: () => void
}) {
  const [all, setAll] = useState(false)
  const person = state.persons[c.personId]
  const pref = c.preferred && 'option' in c.preferred ? c.preferred.option : undefined
  const shown = all ? c.returns : c.returns.slice(0, 5)
  const quick = pref ? [pref, ...c.returns.filter((r) => r.date !== pref.date).slice(0, 2)] : c.returns.slice(0, 3)
  const chains = c.reasons.some((r) => r.startsWith('Encadena'))
  const retChip = (r: ReturnOption) => <CodeChip code={type === 'quitar' ? r.partnerCode : r.myCode} legend={state.legend} small />
  return (
    <div className="card cand">
      <div className="cand-head" onClick={onToggle}>
        <span className="av-wrap">
          <Avatar p={person} size={44} />
          <span className="rank">{rank}</span>
        </span>
        <div className="cand-main">
          <span className="cand-name">
            {person?.puesto && <span className="num-badge">{person.puesto}</span>}
            <b>{shortName(person)}</b>
          </span>
          <span className="full">{person?.name}</span>
          <div className="cand-tags">
            {type === 'turno' ? (
              <span className="tag accent">tiene {visualKind(state.legend, c.codeOnDate) === 'noche' ? 'noche' : 'diurno'}</span>
            ) : c.returns.length ? (
              <span className="tag accent">{c.returns.length} devoluciones</span>
            ) : (
              <span className="tag">{missingMine ? 'sin devolución en tus días conocidos' : 'sin devolución posible'}</span>
            )}
            {c.balance > 0 && <span className="tag ok">te debe {c.balance}</span>}
            {c.balance < 0 && <span className="tag warn">le debes {-c.balance}</span>}
            {chains && <span className="tag ok">encadena</span>}
            {c.softIssues.length > 0 && <span className="tag warn">aviso</span>}
          </div>
        </div>
        <span className={`chev${open ? ' open' : ''}`}>
          <Icon name="down" size={20} />
        </span>
      </div>
      {type !== 'turno' && !c.returns.length && c.noReturn && <p className="hint no-ret">{c.noReturn}</p>}
      {type === 'turno' && !open && (
        <div className="quick-rets">
          <button className="qret best" onClick={() => onRegister(c)}>
            Cambiar con {shortName(person)}
          </button>
        </div>
      )}
      {pref && (
        <p className="ok">
          Devuelve el {fmtShort(pref.date)}
          {pref.notes.length > 0 && ` · ${pref.notes.join(' · ')}`}
        </p>
      )}
      {!open && quick.length > 0 && (
        <div className="quick-rets">
          {quick.map((r, i) => (
            <button key={r.date} className={`qret${i === 0 ? ' best' : ''}`} onClick={() => onRegister(c, r.date)} aria-label={`Elegir devolución ${fmtShort(r.date)}`}>
              {fmtShort(r.date)} {retChip(r)}
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="cand-body">
          <ul className="reasons">
            {c.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
            {c.softIssues.map((r) => (
              <li key={r} className="warn">Aviso: {r}</li>
            ))}
          </ul>
          {pref && (
            <div className="ret pref">
              <span>
                <b>Tu fecha:</b> {fmtShort(pref.date)} {retChip(pref)}
              </span>
              <button className="primary" onClick={() => onRegister(c, pref.date)}>Elegir</button>
            </div>
          )}
          {c.returns.length > 0 && (
            <>
              <p className="hint">{type === 'quitar' ? 'Devolución: tú haces un turno suyo.' : 'Devolución: hace un turno tuyo.'}</p>
              <div className="returns">
                {shown.map((r) => (
                  <div key={r.date} className="ret">
                    <span>
                      {fmtShort(r.date)} {retChip(r)}
                      {r.notes.length > 0 && <small> · {r.notes.join(' · ')}</small>}
                    </span>
                    <button onClick={() => onRegister(c, r.date)}>Elegir</button>
                  </div>
                ))}
              </div>
              {c.returns.length > 5 && (
                <button className="link" onClick={() => setAll(!all)}>
                  {all ? 'Ver menos' : `Ver las ${c.returns.length}`}
                </button>
              )}
            </>
          )}
          <button className="secondary" onClick={() => onRegister(c)}>
            {type === 'turno' ? `Cambiar el turno con ${shortName(person)}` : 'Registrar sin devolución'}
          </button>
        </div>
      )}
    </div>
  )
}

function ConfirmSheet({
  state,
  type,
  date,
  meId,
  c,
  returnDate,
  onCancel,
  onConfirm,
}: {
  state: AppState
  type: CambioType
  date: string
  meId: string
  c: Candidate
  returnDate?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const me = state.grid[meId] ?? {}
  const p = state.grid[c.personId] ?? {}
  const partner = state.persons[c.personId]
  const day = (d: string, title: string) => (
    <div>
      <b>{title}</b>
      <span>
        Tú: <CodeChip code={me[d]} legend={state.legend} small /> → <CodeChip code={p[d]} legend={state.legend} small />
      </span>
      <span>
        {shortName(partner)}: <CodeChip code={p[d]} legend={state.legend} small /> → <CodeChip code={me[d]} legend={state.legend} small />
      </span>
    </div>
  )
  return (
    <div className="sheet" onClick={onCancel}>
      <div className="sheet-body" onClick={(e) => e.stopPropagation()}>
        <div className="summary">
          <Avatar p={partner} size={44} />
          <div>
            <b>
              {type === 'turno'
                ? `${label(partner)} hace tu ${visualKind(state.legend, me[date]) === 'noche' ? 'noche' : 'diurno'} y tú su ${visualKind(state.legend, p[date]) === 'noche' ? 'noche' : 'diurno'}`
                : type === 'quitar'
                  ? `${label(partner)} hace tu turno`
                  : `Haces el turno de ${label(partner)}`}
            </b>
            <div className="hint">
              {type === 'turno' ? 'Mismo día: no hace falta devolución' : returnDate ? `Devolución el ${fmtShort(returnDate)}` : 'Sin devolución: queda a deber'}
            </div>
          </div>
        </div>
        <div className="swap-preview">
          {day(date, fmtShort(date))}
          {type === 'turno' ? null : returnDate ? day(returnDate, `Devolución ${fmtShort(returnDate)}`) : <div className="hint">Sin día de devolución</div>}
        </div>
        <p className="hint">Se aplica al calendario como pendiente hasta que lo recoja la plantilla oficial.</p>
        <div className="row">
          <button onClick={onCancel}>Cancelar</button>
          <button className="primary" onClick={onConfirm}>
            Registrar cambio
          </button>
        </div>
      </div>
    </div>
  )
}
