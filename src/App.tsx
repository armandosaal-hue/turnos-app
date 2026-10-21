import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState } from './domain/types'
import { loadState, saveState } from './store'
import { ChangeView } from './ui/ChangeView'
import { CalendarView } from './ui/CalendarView'
import { ImportView } from './ui/ImportView'
import { CambiosView } from './ui/CambiosView'
import { SettingsView } from './ui/SettingsView'

type Tab = 'cambiar' | 'calendario' | 'cargar' | 'cambios' | 'ajustes'

const TABS: [Tab, string, string][] = [
  ['cambiar', 'Cambiar', '⇄'],
  ['calendario', 'Calendario', '▦'],
  ['cargar', 'Cargar', '⇪'],
  ['cambios', 'Cambios', '☰'],
  ['ajustes', 'Ajustes', '⚙'],
]

export function App() {
  const [state, setStateRaw] = useState<AppState | null>(null)
  const [tab, setTab] = useState<Tab>('cambiar')
  const [saveError, setSaveError] = useState(false)
  const timer = useRef<number>()

  useEffect(() => {
    loadState().then((s) => {
      setStateRaw(s)
      if (!Object.keys(s.grid).length) setTab('cargar')
    })
  }, [])

  const setState = useCallback((s: AppState) => {
    setStateRaw(s)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => setSaveError(!(await saveState(s))), 300)
  }, [])

  if (!state) return <div className="empty">Cargando…</div>

  return (
    <div className="app">
      <header>
        <h1>Turnos</h1>
        {state.meId && <span className="who">{state.persons[state.meId]?.name}</span>}
      </header>
      {saveError && <p className="warn banner">No se pueden guardar los datos en este navegador: se perderán al cerrar.</p>}
      <main>
        {tab === 'cambiar' && <ChangeView state={state} setState={setState} goSettings={() => setTab('ajustes')} />}
        {tab === 'calendario' && <CalendarView state={state} setState={setState} />}
        {tab === 'cargar' && <ImportView state={state} setState={setState} />}
        {tab === 'cambios' && <CambiosView state={state} setState={setState} />}
        {tab === 'ajustes' && <SettingsView state={state} setState={setState} />}
      </main>
      <nav>
        {TABS.map(([k, label, icon]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            <span className="ico">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
