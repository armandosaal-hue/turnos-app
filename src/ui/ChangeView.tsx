import { useMemo, useState } from 'react'
import { allDates, recommend, type Candidate } from '../domain/engine'
import { codeLabel } from '../domain/legend'
import { defaultDate, fmtShort } from '../domain/dates'
import { registerCambio } from '../domain/state'
import type { AppState } from '../domain/types'
import { CodeChip, shortName } from './common'

// Lo que se elige en Cambiar. Vive en App para que no se pierda al cambiar de pestaña.
export interface ChangeUi {
  date?: string
  preferredReturn?: string
  onlyWithReturn: boolean
  open: string[] // candidatos desplegados
}

export const emptyChangeUi: ChangeUi = { onlyWithReturn: false, open: [] }

export function ChangeView({
  state,
  setState,
  goSettings,
  goMyShifts,
  ui,
  setUi,
}: {
  state: AppState
  setState: (s: AppState) => void
  goSettings: () => void
  goMyShifts: () => void
  ui: ChangeUi
  setUi: (u: ChangeUi) => void
}) {
  const dates = useMemo(() => allDates(state.grid), [state.grid])
  const date = ui.date && dates.includes(ui.date) ? ui.date : defaultDate(dates)
  const { onlyWithReturn, preferredReturn } = ui
  const [showDiscarded, setShowDiscarded] = useState(false)
  const [showNotValid, setShowNotValid] = useState(false)
  const [pending, setPending] = useState<{ c: Candidate; returnDate?: string; msg: string } | null>(null)

  const meId = state.meId
  const rec = useMemo(
    () => (meId && dates.length ? recommend(state, meId, date, { preferredReturn }) : null),
    [state, meId, date, dates.length, preferredReturn],
  )
  const setDate = (d: string) => setUi({ ...ui, date: d, preferredReturn: undefined, open: [] })
  const toggleOpen = (id: string) =>
    setUi({ ...ui, open: ui.open.includes(id) ? ui.open.filter((x) => x !== id) : [...ui.open, id] })

  if (!dates.length) return <div className="empty">Primero carga una plantilla en la pestaña <b>Cargar</b>.</div>
  if (!meId || !state.persons[meId])
    return (
      <div className="empty">
        <p>Indica quién eres en <b>Ajustes</b>. Si todavía no apareces en la plantilla, elige a un compañero para probar.</p>
        <button className="primary" onClick={goSettings}>Ir a Ajustes</button>
      </div>
    )

  const me = state.grid[meId]
  const myCode = me[date]
  // Las devoluciones solo se buscan en días en que la app conoce mi turno.
  const month = date.slice(0, 7)
  const loadedInMonth = dates.filter((d) => d.startsWith(month))
  const knownInMonth = loadedInMonth.filter((d) => me[d] !== undefined).length
  const missingMine = loadedInMonth.length > 0 && knownInMonth < loadedInMonth.length
  const all = rec ? rec.candidates.filter((c) => !onlyWithReturn || c.returns.length) : []
  const fits = (c: Candidate) => !!c.preferred && 'option' in c.preferred
  const list = preferredReturn ? all.filter(fits) : all
  const notValid = preferredReturn ? all.filter((c) => !fits(c)) : []
  const reasons = new Set(notValid.map((c) => (c.preferred && 'reason' in c.preferred ? c.preferred.reason : '')))
  const commonReason = !list.length && notValid.length > 1 && reasons.size === 1 ? [...reasons][0] : ''

  const register = (c: Candidate, returnDate?: string) => {
    if (!rec?.type) return
    const partner = state.persons[c.personId]
    const msg =
      rec.type === 'quitar'
        ? `${shortName(partner)} hace tu turno del ${fmtShort(date)}${returnDate ? ` y tú haces el suyo del ${fmtShort(returnDate)}` : ' (sin devolución)'}.`
        : `Haces el turno de ${shortName(partner)} del ${fmtShort(date)}${returnDate ? ` y ${shortName(partner)} hace el tuyo del ${fmtShort(returnDate)}` : ' (sin devolución)'}.`
    setPending({ c, returnDate, msg })
  }

  return (
    <div className="view">
      <div className="card">
        <label className="field">
          <span>Día</span>
          <input type="date" value={date} min={dates[0]} max={dates[dates.length - 1]} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <p className="me-line">
          {fmtShort(date)} · tú: <CodeChip code={myCode} legend={state.legend} /> {codeLabel(state.legend, myCode)}
        </p>
        {rec?.error && <p className="warn">{rec.error}</p>}
        {missingMine && (
          <div className="notice">
            <p>
              Solo tengo <b>{knownInMonth} de {loadedInMonth.length}</b> días tuyos de este mes
              {state.persons[meId]?.puesto ? '' : ' (no apareces en la plantilla)'}. Las devoluciones solo se buscan en días en que sé que libras, así que
              faltarán opciones.
            </p>
            <button onClick={goMyShifts}>Meter mis turnos</button>
          </div>
        )}
        {rec?.type && (
          <p className="hint">
            {rec.type === 'quitar' ? 'Quitarme este turno: compañeros que pueden cubrirlo.' : 'Ponerme a trabajar: compañeros que pueden cederme su turno.'}
          </p>
        )}
        {rec?.type && (
          <label className="check">
            <input type="checkbox" checked={onlyWithReturn} onChange={(e) => setUi({ ...ui, onlyWithReturn: e.target.checked })} /> Solo con devolución posible
          </label>
        )}
        {rec?.type && (
          <label className="field">
            <span>Propongo devolver el día (opcional)</span>
            <span className="row">
              <input
                id="devolver"
                type="date"
                value={preferredReturn ?? ''}
                min={dates[0]}
                max={dates[dates.length - 1]}
                onChange={(e) => setUi({ ...ui, preferredReturn: e.target.value || undefined })}
              />
              {preferredReturn && <button onClick={() => setUi({ ...ui, preferredReturn: undefined })}>Quitar</button>}
            </span>
          </label>
        )}
        {rec?.type && preferredReturn && (
          <p className="me-line">
            {fmtShort(preferredReturn)} · tú: <CodeChip code={me[preferredReturn]} legend={state.legend} /> {codeLabel(state.legend, me[preferredReturn])}
          </p>
        )}
      </div>

      {rec?.type && (
        <>
          <h2>
            {list.length} {list.length === 1 ? 'candidato' : 'candidatos'}
            {preferredReturn && ` con devolución el ${fmtShort(preferredReturn)}`}
          </h2>
          {commonReason && <p className="warn">Nadie vale para ese día: {commonReason}.</p>}
          {list.map((c, i) => (
            <CandidateCard
              key={c.personId}
              rank={i + 1}
              c={c}
              state={state}
              type={rec.type!}
              onRegister={register}
              missingMine={missingMine}
              open={ui.open.includes(c.personId)}
              onToggle={() => toggleOpen(c.personId)}
            />
          ))}
          {preferredReturn && notValid.length > 0 && (
            <>
              <button className="link" onClick={() => setShowNotValid(!showNotValid)}>
                {showNotValid ? 'Ocultar' : 'Ver'} los que no valen para el {fmtShort(preferredReturn)} ({notValid.length})
              </button>
              {showNotValid && (
                <ul className="discarded">
                  {notValid.map((c) => (
                    <li key={c.personId}>
                      <b>{shortName(state.persons[c.personId])}</b>: {c.preferred && 'reason' in c.preferred ? c.preferred.reason : ''}
                      {c.returns.length > 0 && ` · otras devoluciones: ${c.returns.slice(0, 3).map((r) => fmtShort(r.date)).join(', ')}`}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <button className="link" onClick={() => setShowDiscarded(!showDiscarded)}>
            {showDiscarded ? 'Ocultar' : 'Ver'} descartados ({rec.discarded.length})
          </button>
          {pending && (
            <div className="sheet" onClick={() => setPending(null)}>
              <div className="sheet-body" onClick={(e) => e.stopPropagation()}>
                <p>{pending.msg}</p>
                <p className="hint">Se aplica al calendario como pendiente hasta que lo recoja la plantilla oficial.</p>
                <div className="row">
                  <button onClick={() => setPending(null)}>Cancelar</button>
                  <button
                    className="primary"
                    onClick={() => {
                      setState(registerCambio(state, meId, rec.type!, date, pending.c.personId, pending.returnDate))
                      setPending(null)
                    }}
                  >
                    Registrar cambio
                  </button>
                </div>
              </div>
            </div>
          )}
          {showDiscarded && (
            <ul className="discarded">
              {rec.discarded.map((d) => (
                <li key={d.personId}>
                  <b>{shortName(state.persons[d.personId])}</b>: {d.reason}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
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
  type: 'quitar' | 'trabajar'
  onRegister: (c: Candidate, returnDate?: string) => void
  missingMine: boolean
  open: boolean
  onToggle: () => void
}) {
  const [all, setAll] = useState(false)
  const pref = c.preferred && 'option' in c.preferred ? c.preferred.option : undefined
  const shown = all ? c.returns : c.returns.slice(0, 5)
  return (
    <div className="card cand">
      <div className="cand-head" onClick={onToggle}>
        <span className="rank">{rank}</span>
        <div className="cand-main">
          <b>{state.persons[c.personId]?.name}</b>
          <small>
            {c.returns.length
              ? `${c.returns.length} devoluciones posibles`
              : missingMine
                ? 'sin devolución en los días tuyos que conozco'
                : 'sin devolución posible'}
            {c.balance > 0 && ` · te debe ${c.balance}`}
            {c.balance < 0 && ` · le debes ${-c.balance}`}
          </small>
          {pref && (
            <small className="ok">
              Devuelve el {fmtShort(pref.date)}
              {pref.notes.length > 0 && ` · ${pref.notes.join(' · ')}`}
            </small>
          )}
        </div>
        <span className="chev">{open ? '▴' : '▾'}</span>
      </div>
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
            <div className="ret">
              <span>
                <b>Tu fecha:</b> {fmtShort(pref.date)} <CodeChip code={type === 'quitar' ? pref.partnerCode : pref.myCode} legend={state.legend} small />
              </span>
              <button className="primary" onClick={() => onRegister(c, pref.date)}>Elegir</button>
            </div>
          )}
          {c.returns.length > 0 && (
            <>
              <p className="hint">
                {type === 'quitar' ? 'Devolución: tú haces un turno suyo.' : 'Devolución: hace un turno tuyo.'}
              </p>
              <div className="returns">
                {shown.map((r) => (
                  <div key={r.date} className="ret">
                    <span>
                      {fmtShort(r.date)} <CodeChip code={type === 'quitar' ? r.partnerCode : r.myCode} legend={state.legend} small />
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
            Registrar sin devolución
          </button>
        </div>
      )}
    </div>
  )
}
