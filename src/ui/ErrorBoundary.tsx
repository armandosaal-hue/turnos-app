import { Component, type ReactNode } from 'react'

const RELOAD_FLAG = 'turnos-recarga'

// Si el móvil tiene una versión antigua de la app, el código nuevo no se encuentra: se recarga una vez.
export function isStaleChunk(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(m)
}

export function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch {
    return false
  }
  location.reload()
  return true
}

// Muestra el error en pantalla en vez de dejarla en blanco.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown) {
    if (isStaleChunk(error)) reloadOnce()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const e = error instanceof Error ? error : new Error(String(error))
    return (
      <div className="view">
        <div className="card">
          <h2>Algo ha fallado</h2>
          <p>La app ha encontrado un error. Haz una captura de esta pantalla y envíasela a quien te ayuda con la app.</p>
          <pre className="err">
            {e.name}: {e.message}
            {'\n'}
            {(e.stack ?? '').split('\n').slice(1, 4).join('\n')}
            {'\n'}
            {navigator.userAgent}
          </pre>
          <div className="row">
            <button onClick={() => this.setState({ error: null })}>Volver</button>
            <button className="primary" onClick={() => location.reload()}>Recargar la app</button>
          </div>
        </div>
      </div>
    )
  }
}
