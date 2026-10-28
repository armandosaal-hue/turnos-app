import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState } from './domain/types'
import { loadState, saveState } from './store'
import { ChangeView, emptyChangeUi, type ChangeUi } from './ui/ChangeView'
import { CalendarView } from './ui/CalendarView'
import { CambiosView } from './ui/CambiosView'
import { MoreView, type MoreSection } from './ui/MoreView'
import { TodayView } from './ui/TodayView'
import { shortName } from './ui/common'
import { Icon, type IconName } from './ui/icons'
import { MONTHS, todayIso } from './domain/dates'
import { ErrorBoundary, isStaleChunk, reloadOnce } from './ui/ErrorBoundary'

type Tab = 'hoy' | 'cambiar' | 'calendario' | 'cambios' | 'mas'

const TABS: [Tab, string, IconName][] = [
  ['hoy', 'Hoy', 'home'],
  ['cambiar', 'Cambiar', 'swap'],
  ['calendario', 'Calendario', 'calendar'],
  ['cambios', 'Cambios', 'list'],
  ['mas', 'Más', 'more'],
]

const CHANGE_UI_KEY = 'turnos-cambiar'

function loadChangeUi(): ChangeUi {
  try {
    const raw = localStorage.getItem(CHANGE_UI_KEY)
    if (raw) return { ...emptyChangeUi, ...JSON.parse(raw) }
  } catch {
    // ignorado: se empieza en blanco
  }
  return emptyChangeUi
}

export function App() {
  const [state, setStateRaw] = useState<AppState | null>(null)
  const [tab, setTab] = useState<Tab>('hoy')
  const [more, setMore] = useState<MoreSection | null>(null)
  const [saveError, setSaveError] = useState(false)
  const timer = useRef<number>()

  const [globalError, setGlobalError] = useState('')
  const [changeUi, setChangeUiRaw] = useState<ChangeUi>(loadChangeUi)
  const setChangeUi = useCallback((u: ChangeUi) => {
    setChangeUiRaw(u)
    try {
      localStorage.setItem(CHANGE_UI_KEY, JSON.stringify(u))
    } catch {
      // sin almacenamiento: se mantiene mientras la app siga abierta
    }
  }, [])

  // Errores fuera de React (promesas, carga de código): se muestran en vez de bloquear la pantalla.
  useEffect(() => {
    const onErr = (reason: unknown) => {
      if (isStaleChunk(reason) && reloadOnce()) return
      setGlobalError(reason instanceof Error ? reason.message : String(reason))
    }
    const a = (e: ErrorEvent) => onErr(e.error ?? e.message)
    const b = (e: PromiseRejectionEvent) => onErr(e.reason)
    window.addEventListener('error', a)
    window.addEventListener('unhandledrejection', b)
    return () => {
      window.removeEventListener('error', a)
      window.removeEventListener('unhandledrejection', b)
    }
  }, [])

  useEffect(() => {
    loadState().then((s) => {
      setStateRaw(s)
      if (!Object.keys(s.grid).length) {
        setTab('mas')
        setMore('cargar')
      }
    })
  }, [])

  const setState = useCallback((s: AppState) => {
    setStateRaw(s)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => setSaveError(!(await saveState(s))), 300)
  }, [])

  if (!state) return <div className="empty">Cargando…</div>

  const goMore = (section: MoreSection) => {
    setTab('mas')
    setMore(section)
  }
  const [ty, tm] = todayIso().split('-').map(Number)

  return (
    <div className="app">
      <header>
        <span className="head-logo">
          <Icon name="calendar" size={22} />
        </span>
        <div className="head-text">
          <h1>Turnos UCI</h1>
          <span className="who">
            {state.meId && state.persons[state.meId] ? shortName(state.persons[state.meId]) : 'Sin identificar'} · {MONTHS[tm - 1].toLowerCase()} {ty}
          </span>
        </div>
      </header>
      {saveError && <p className="warn banner">No se pueden guardar los datos en este navegador: se perderán al cerrar.</p>}
      {globalError && (
        <p className="warn banner">
          Error: {globalError} <button className="link" onClick={() => setGlobalError('')}>Cerrar</button>
        </p>
      )}
      <main>
        <ErrorBoundary key={`${tab}-${more}`}>
          {tab === 'hoy' && (
            <TodayView
              state={state}
              openDay={(date) => {
                setChangeUi({ ...changeUi, date, preferredReturn: undefined, open: [] })
                setTab('cambiar')
              }}
              goMyShifts={() => setTab('calendario')}
              goMore={goMore}
            />
          )}
          {tab === 'cambiar' && (
            <ChangeView
              state={state}
              setState={setState}
              goSettings={() => goMore('yo')}
              goMyShifts={() => setTab('calendario')}
              goLoad={() => goMore('cargar')}
              ui={changeUi}
              setUi={setChangeUi}
            />
          )}
          {tab === 'calendario' && <CalendarView state={state} setState={setState} />}
          {tab === 'cambios' && <CambiosView state={state} setState={setState} />}
          {tab === 'mas' && <MoreView state={state} setState={setState} section={more} setSection={setMore} />}
        </ErrorBoundary>
      </main>
      <nav>
        {TABS.map(([k, label, icon]) => (
          <button
            key={k}
            className={tab === k ? 'on' : ''}
            onClick={() => {
              if (k === 'mas' && tab === 'mas') setMore(null)
              setTab(k)
            }}
          >
            <span className="ico">
              <Icon name={icon} />
            </span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
