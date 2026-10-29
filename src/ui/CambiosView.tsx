import { useState } from 'react'
import { balanceWith } from '../domain/engine'
import { fmtShort } from '../domain/dates'
import { deleteCambio } from '../domain/state'
import type { AppState } from '../domain/types'
import { Avatar, CodeChip, Empty, shortName } from './common'

export function CambiosView({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const partners = [...new Set(state.cambios.map((c) => c.partnerId))]
  const balances = partners.map((p) => ({ p, b: balanceWith(state.cambios, p) })).filter((x) => x.b !== 0)

  return (
    <div className="view">
      <p className="section-title">Saldo</p>
      {balances.length === 0 && <p className="hint">Sin días pendientes con nadie.</p>}
      {balances.map(({ p, b }) => (
        <div key={p} className="card balance">
          <Avatar p={state.persons[p]} />
          <span>{shortName(state.persons[p])}</span>
          <span className={`num-big ${b > 0 ? 'ok' : 'warn'}`}>
            <b>{Math.abs(b)}</b>
            {b > 0 ? 'te debe' : 'le debes'}
          </span>
        </div>
      ))}

      <p className="section-title">Cambios registrados</p>
      {state.cambios.length === 0 && (
        <Empty icon="swap">
          <p>Todavía no has registrado ninguno. Los cambios que elijas en Cambiar aparecerán aquí.</p>
        </Empty>
      )}
      {state.cambios.map((c) => (
        <div key={c.id} className="card">
          <div className="summary">
            <Avatar p={state.persons[c.partnerId]} />
            <div>
              <b>
                {c.type === 'turno' ? 'Cambio de turno' : c.type === 'quitar' ? 'Me quito' : 'Me pongo'} el {fmtShort(c.date)}
              </b>
              <div className="hint">con {state.persons[c.partnerId]?.name}</div>
            </div>
          </div>
          <p className="hint">
            {c.type === 'turno' ? 'Mismo día, sin devolución' : c.returnDate ? `Devolución el ${fmtShort(c.returnDate)}` : 'Sin devolución'}
          </p>
          <p className="cells">
            {c.cells.map((cell) => (
              <span key={`${cell.personId}${cell.date}`}>
                {cell.personId === state.meId ? 'tú' : state.persons[cell.personId]?.name.split(',')[1]?.trim()} {fmtShort(cell.date)}:{' '}
                <CodeChip code={cell.before} legend={state.legend} small />→<CodeChip code={cell.after} legend={state.legend} small />
              </span>
            ))}
          </p>
          <p>
            <span className={`tag ${c.status === 'confirmado' ? 'ok' : ''}`}>
              {c.status === 'confirmado' ? 'confirmado por la plantilla' : 'pendiente'}
            </span>
            {c.notReflected && <span className="tag warn">no aparece en la última plantilla</span>}
          </p>
          {confirmDel === c.id ? (
            <div className="row">
              <button onClick={() => setConfirmDel(null)}>No</button>
              <button
                className="danger"
                onClick={() => {
                  setState(deleteCambio(state, c.id))
                  setConfirmDel(null)
                }}
              >
                Sí, borrar y deshacer
              </button>
            </div>
          ) : (
            <button className="link" onClick={() => setConfirmDel(c.id)}>Borrar cambio</button>
          )}
        </div>
      ))}
    </div>
  )
}
