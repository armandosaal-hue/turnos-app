import { useState } from 'react'
import { balanceWith } from '../domain/engine'
import { fmtShort } from '../domain/dates'
import { deleteCambio } from '../domain/state'
import type { AppState } from '../domain/types'
import { CodeChip } from './common'

export function CambiosView({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const partners = [...new Set(state.cambios.map((c) => c.partnerId))]
  const balances = partners.map((p) => ({ p, b: balanceWith(state.cambios, p) })).filter((x) => x.b !== 0)

  return (
    <div className="view">
      <h2>Saldo</h2>
      {balances.length === 0 && <p className="hint">Sin días pendientes con nadie.</p>}
      {balances.map(({ p, b }) => (
        <div key={p} className="card row between">
          <span>{state.persons[p]?.name}</span>
          <b className={b > 0 ? 'ok' : 'warn'}>{b > 0 ? `te debe ${b}` : `le debes ${-b}`}</b>
        </div>
      ))}

      <h2>Cambios registrados</h2>
      {state.cambios.length === 0 && <p className="hint">Todavía no has registrado ninguno.</p>}
      {state.cambios.map((c) => (
        <div key={c.id} className="card">
          <p>
            <b>{c.type === 'quitar' ? 'Me quito' : 'Me pongo'}</b> el {fmtShort(c.date)} con <b>{state.persons[c.partnerId]?.name}</b>
            {c.returnDate ? ` · devolución el ${fmtShort(c.returnDate)}` : ' · sin devolución'}
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
