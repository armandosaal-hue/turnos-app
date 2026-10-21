import { get, set, del } from 'idb-keyval'

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (más precisa)', input: 4, output: 20 },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (más barata)', input: 2, output: 10 },
] as const

export interface VisionSettings {
  apiKey: string
  model: string
}

// La clave se guarda aparte del resto de datos para que no salga en las copias de seguridad.
const KEY = 'turnos-vision'

export async function loadVisionSettings(): Promise<VisionSettings> {
  try {
    const s = (await get(KEY)) as VisionSettings | undefined
    if (s) return s
  } catch {
    // sin almacenamiento
  }
  return { apiKey: '', model: MODELS[0].id }
}

export async function saveVisionSettings(s: VisionSettings): Promise<void> {
  try {
    if (s.apiKey) await set(KEY, s)
    else await del(KEY)
  } catch {
    // sin almacenamiento
  }
}

