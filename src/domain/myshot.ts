import { z } from 'zod'
import { addDays, daysInMonth, isoDate } from './dates'
import { kindOf } from './legend'
import type { Legend } from './types'

// Captura de la app de turnos personal de Armando: solo interesa qué días tiene
// diurno o noche. Lo demás se convierte en D (tras noche) o L.
export type MyShift = 'diurno' | 'noche' | 'otro'

export const MyShotSchema = z.object({
  mes: z.number().int().describe('Mes que muestra la captura (1-12); 0 si no se ve'),
  anio: z.number().int().describe('Año que muestra la captura; 0 si no se ve'),
  dias: z.array(
    z.object({
      dia: z.number().int().describe('Número de día del mes principal de la captura'),
      turno: z.enum(['diurno', 'noche', 'otro']).describe('diurno = turno de día; noche = turno de noche; otro = cualquier otra cosa o nada'),
      texto: z.string().describe('Lo que pone en ese día, tal cual (letra, horas, etiqueta); "" si nada'),
      dudoso: z.boolean().describe('true si no está claro qué turno es'),
    }),
  ),
  criterio: z.string().describe('Cómo se distinguen en la captura el diurno y la noche (colores, letras, horas, iconos)'),
  avisos: z.array(z.string()).describe('Problemas: días cortados, mes no visible, etiquetas que no se entienden'),
})

export type MyShot = z.infer<typeof MyShotSchema>

export const MY_SHOT_PROMPT = `Esta imagen es una captura de pantalla de la app de turnos personal de una enfermera de UCI. Muestra sus turnos de un mes (en calendario o en lista).

Solo hay dos turnos que importan:
- diurno: turno de día de 12 h (08:00-20:00). Puede aparecer como "Diurno", "Día", "D", "M/T", "12h día", un sol, un color o el horario 8-20.
- noche: turno de noche de 12 h (20:00-08:00). Puede aparecer como "Nocturno", "Noche", "N", una luna, un color o el horario 20-8.
Todo lo demás (libre, descanso, vacaciones, días vacíos, festivos, notas) es "otro".

Instrucciones:
- Averigua primero la leyenda de la app (qué letra, color, icono u horario corresponde a día y a noche) y explícalo en "criterio".
- El mes principal es el del título de la pantalla (p. ej. "Noviembre"). Usa SOLO sus días. La cuadrícula suele mostrar al principio días del mes anterior (26, 27… 31) y al final días del mes siguiente (1, 2, 3…), con el número en gris o más claro: ignóralos aunque tengan turnos.
- "dias": un elemento por cada día del mes principal que se vea, con su número.
- Si un día tiene varias etiquetas (p. ej. "Diurno" y "Ufv eco"), y una es diurno o noche, el turno es ese. Etiquetas de cursos, docencia, notas o eventos ("Ufv eco", "competi"…) son "otro".
- Si una etiqueta "D" podría ser "descanso" en vez de "día", decide por el contexto (horario, color, si va justo después de una noche) y marca dudoso = true si no está claro.
- "texto": copia lo que pone en el día, tal cual.
- "mes" y "anio": los del mes que se muestra; 0 si no se ven.
- No inventes: si un día está tapado o cortado, no lo incluyas y avísalo en "avisos".`

export function myShotChatPrompt(): string {
  return `${MY_SHOT_PROMPT.replace('Esta imagen es una captura', 'Cada imagen adjunta es una captura')}

Formato de la respuesta: devuelve SOLO un bloque de código \`\`\`json con una lista que tenga un objeto por captura, en el mismo orden. Sin texto antes ni después. Cada objeto tiene exactamente estos campos:
{
  "mes": número del 1 al 12 o 0,
  "anio": número o 0,
  "dias": [ { "dia": 1, "turno": "diurno" | "noche" | "otro", "texto": "texto", "dudoso": false } ],
  "criterio": "texto",
  "avisos": ["texto"]
}`
}

const LenientShot = z.object({
  mes: z.coerce.number().int().catch(0),
  anio: z.coerce.number().int().catch(0),
  dias: z.array(
    z.object({
      dia: z.coerce.number().int(),
      turno: z
        .string()
        .transform((t) => t.toLowerCase())
        .transform((t): MyShift => (t.startsWith('d') ? 'diurno' : t.startsWith('n') ? 'noche' : 'otro')),
      texto: z.coerce.string().catch(''),
      dudoso: z.boolean().catch(false),
    }),
  ),
  criterio: z.string().catch(''),
  avisos: z.array(z.string()).catch([]),
})

// Extrae las capturas de la respuesta pegada del chat (con o sin bloque de código).
export function parsePastedMyShots(text: string): MyShot[] {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text
  const start = block.search(/[[{]/)
  const end = Math.max(block.lastIndexOf(']'), block.lastIndexOf('}'))
  if (start < 0 || end <= start) throw new Error('No encuentro los turnos en el texto pegado. Copia la respuesta completa de Claude.')
  let data: unknown
  try {
    data = JSON.parse(block.slice(start, end + 1))
  } catch {
    throw new Error('La respuesta está cortada o incompleta. Pide a Claude que la repita.')
  }
  const list = Array.isArray(data) ? data : [data]
  return list.map((item, i) => {
    const r = LenientShot.safeParse(item)
    if (!r.success) throw new Error(`La captura ${i + 1} de la respuesta no tiene el formato esperado.`)
    return r.data
  })
}

export interface MyMonth {
  year: number
  month: number
  shifts: Record<number, MyShift> // día del mes → turno leído
  doubtful: number[]
}

// Una captura con mes pero sin año: el año que deja ese mes más cerca de hoy.
export function nearestYear(month: number, today: { year: number; month: number }): number {
  const opts = [today.year - 1, today.year, today.year + 1]
  const dist = (y: number) => Math.abs(y * 12 + month - (today.year * 12 + today.month))
  return opts.reduce((a, b) => (dist(b) < dist(a) ? b : a))
}

// Une las capturas por mes. Si una no trae mes, se usa el que se indique.
export function shotsToMonths(shots: MyShot[], fallback: { year: number; month: number }, today = fallback): MyMonth[] {
  const byKey = new Map<string, MyMonth>()
  for (const s of shots) {
    const hasMonth = s.mes >= 1 && s.mes <= 12
    const month = hasMonth ? s.mes : fallback.month
    const year = s.anio >= 2000 ? s.anio : hasMonth ? nearestYear(month, today) : fallback.year
    const key = `${year}-${month}`
    const m = byKey.get(key) ?? { year, month, shifts: {}, doubtful: [] }
    for (const d of s.dias) {
      if (d.dia < 1 || d.dia > daysInMonth(year, month)) continue
      // Si dos capturas del mismo mes no coinciden, gana el turno de trabajo.
      if (m.shifts[d.dia] === undefined || d.turno !== 'otro') m.shifts[d.dia] = d.turno
      if (d.dudoso && !m.doubtful.includes(d.dia)) m.doubtful.push(d.dia)
    }
    byKey.set(key, m)
  }
  return [...byKey.values()].sort((a, b) => a.year - b.year || a.month - b.month)
}

export interface MyCodesOptions {
  nightCode?: string
  restCode?: string
  freeCode?: string
  dayCode?: string
}

// Códigos para mi fila: diurno, N, D el día después de cada noche (si ese día no
// trabajo) y L en el resto de días del mes. Si el mes acaba en noche, el D cae el
// día 1 del mes siguiente siempre que ese día no tenga ya turno.
export function myCodes(
  months: MyMonth[],
  current: Record<string, string>,
  legend: Legend,
  { nightCode = 'N', restCode = 'D', freeCode = 'L', dayCode = '' }: MyCodesOptions = {},
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of months) {
    for (let d = 1; d <= daysInMonth(m.year, m.month); d++) {
      const s = m.shifts[d]
      out[isoDate(m.year, m.month, d)] = s === 'diurno' ? dayCode : s === 'noche' ? nightCode : freeCode
    }
  }
  for (const date of Object.keys(out).sort()) {
    if (out[date] !== nightCode) continue
    const next = addDays(date, 1)
    if (next in out) {
      if (out[next] === freeCode) out[next] = restCode
    } else {
      const c = current[next]
      if (c === undefined || kindOf(legend, c) === 'libre') out[next] = restCode
    }
  }
  return out
}
