import { get, set, del } from 'idb-keyval'
import { emptyState } from './domain/state'
import type { AppState } from './domain/types'

const KEY = 'turnos-state'

export async function loadState(): Promise<AppState> {
  try {
    const s = (await get(KEY)) as AppState | undefined
    if (s && s.schema === 1) return s
  } catch {
    // Sin IndexedDB (modo privado, vista previa): se trabaja en memoria.
  }
  return emptyState()
}

export async function saveState(s: AppState): Promise<boolean> {
  try {
    await set(KEY, s)
    return true
  } catch {
    return false
  }
}

export async function clearState(): Promise<void> {
  try {
    await del(KEY)
  } catch {
    // nada que borrar
  }
}

export function downloadJson(s: AppState) {
  const blob = new Blob([JSON.stringify(s)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `turnos-copia-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
