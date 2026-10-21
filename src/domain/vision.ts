import { z } from 'zod'
import { daysInMonth, isoDate } from './dates'
import { FIXED_BLANK, personKey, type ParsedPlantilla } from './importer'
import { BLANK, type Grid, type Person } from './types'

// Lo que devuelve Claude por cada imagen.
export const ReadingSchema = z.object({
  mes: z.number().int().describe('Mes de la plantilla (1-12) si aparece escrito en la imagen; 0 si no aparece'),
  anio: z.number().int().describe('Año si aparece escrito en la imagen; 0 si no aparece'),
  dias: z.array(z.number().int()).describe('Número de día de cada columna de turnos, de izquierda a derecha'),
  filas: z.array(
    z.object({
      puesto: z.string().describe('Número de puesto de la primera columna, tal cual (p. ej. "10.1", "s3"); "" si no hay'),
      nombre: z.string().describe('Nombre completo tal cual, con lo que haya entre paréntesis'),
      seccion: z.string().describe('Rótulo del bloque al que pertenece la fila ("MAÑANA", "NOCHES A"…); "" en el bloque principal'),
      turno_fijo: z.boolean().describe('true si la fila está bajo un rótulo de turno fijo (MAÑANA, TARDE, NOCHES…)'),
      celdas: z.array(z.string()).describe('Un código por día, en el mismo orden que "dias"; "" si la celda está vacía'),
      dudosas: z.array(z.number().int()).describe('Índices (desde 0) de las celdas que no se leen con seguridad'),
    }),
  ),
  avisos: z.array(z.string()).describe('Problemas de lectura: zonas cortadas, borrosas, columnas que no se distinguen'),
})

export type Reading = z.infer<typeof ReadingSchema>

export const VISION_PROMPT = `Esta imagen es una foto de una página de una plantilla de turnos de enfermería de un hospital. Puede estar girada, inclinada o tener otros papeles alrededor. Es una tabla: cada fila es una persona y cada columna un día del mes.

Transcribe la tabla con exactitud:
- Una fila por cada persona con nombre. No incluyas filas de totales ("TOTAL DIURNOS", "TOTAL NOCTURNOS"), de cabecera, de días de la semana ni rótulos de sección.
- "dias": el número de día de cada columna de turnos, de izquierda a derecha según la orientación de la tabla. Usa los números impresos; si no hay, usa los escritos a mano. Si no hay ninguno, cuenta las columnas empezando en 1.
- "celdas": exactamente un elemento por cada día de "dias", en el mismo orden. Copia el código tal como aparece (respeta mayúsculas y minúsculas: "Lh", "LH", "N", "D", "L", "B", "V", "x", "PC", "pc", "Lac", "%", "12"…).
- Una celda vacía es información, no un hueco: en el bloque principal significa un turno de día. Devuélvela como "". No la rellenes con el código de la celda de al lado ni desplaces los códigos siguientes. Antes de escribir cada fila, comprueba que cada código cae en la columna de su día siguiendo la cuadrícula.
- Ignora lo escrito a mano (números, rayas, firmas), el sombreado de las celdas y lo que no forme parte de la tabla.
- "seccion" y "turno_fijo": si la fila está debajo de un rótulo como "MAÑANA", "TARDE", "NOCHES A" o "NOCHES B", pon ese rótulo y turno_fijo = true. En el bloque principal, seccion = "" y turno_fijo = false.
- "dudosas": índices de las celdas que no puedas leer con seguridad (borrosas, cortadas, dudas de columna). Si dudas, márcala; no inventes.
- "mes" y "anio": solo si aparecen escritos en la imagen; si no, 0.`

export interface ImageReading {
  fileName: string
  reading: Reading
}

export interface VisionPlantilla extends ParsedPlantilla {
  doubtful: Record<string, true> // "personId|fecha"
}

// Une las lecturas de varias imágenes (troceadas por personas, por fechas o ambas)
// en una sola plantilla. El mes y el año base los confirma la persona.
export function readingsToPlantilla(readings: ImageReading[], year: number, month: number): VisionPlantilla {
  const persons: Record<string, Person> = {}
  const grid: Grid = {}
  const doubtful: Record<string, true> = {}
  const warnings: string[] = []
  let conflicts = 0

  for (const { fileName, reading } of readings) {
    let m = reading.mes >= 1 && reading.mes <= 12 ? reading.mes : month
    let y = reading.anio >= 2000 ? reading.anio : year
    const dates: (string | null)[] = []
    let prev = 0
    let bad = 0
    for (const d of reading.dias) {
      if (d < prev) {
        m++
        if (m > 12) {
          m = 1
          y++
        }
      }
      prev = d
      if (d < 1 || d > daysInMonth(y, m)) {
        dates.push(null)
        bad++
      } else dates.push(isoDate(y, m, d))
    }
    if (bad) warnings.push(`${fileName}: ${bad} columnas con un día que no existe; se han ignorado.`)
    for (const a of reading.avisos) warnings.push(`${fileName}: ${a}`)

    for (const fila of reading.filas) {
      if (!fila.nombre.trim()) continue
      const { id, name, note } = personKey(fila.nombre)
      if (!persons[id]) {
        persons[id] = { id, name, note, puesto: fila.puesto, section: fila.seccion || 'Rotatorio', candidate: !fila.turno_fijo }
      }
      if (fila.celdas.length !== reading.dias.length) {
        warnings.push(`${fileName}: la fila de ${name} tiene ${fila.celdas.length} celdas para ${reading.dias.length} días; revísala.`)
      }
      const row = (grid[id] ??= {})
      const dudosas = new Set(fila.dudosas)
      dates.forEach((date, i) => {
        if (!date) return
        let code = (fila.celdas[i] ?? '').trim()
        if (code === BLANK && fila.turno_fijo) code = FIXED_BLANK
        const cur = row[date]
        if (cur === undefined) row[date] = code
        else if (cur !== code) {
          conflicts++
          doubtful[`${id}|${date}`] = true
        }
        if (dudosas.has(i) || fila.celdas[i] === undefined) doubtful[`${id}|${date}`] = true
      })
    }
  }
  if (conflicts) warnings.push(`${conflicts} días leídos distinto en dos imágenes; se ha mantenido el primero y están marcados para revisar.`)

  const all = Object.values(grid).flatMap((r) => Object.keys(r)).sort()
  if (!all.length) throw new Error('No se ha leído ninguna fila con nombre en las imágenes.')
  const codes: Record<string, number> = {}
  for (const r of Object.values(grid)) for (const c of Object.values(r)) codes[c] = (codes[c] ?? 0) + 1
  return { persons, grid, from: all[0], to: all[all.length - 1], codes, warnings, doubtful }
}

// Mes y año que aparecen en alguna de las imágenes.
export function detectedMonth(readings: ImageReading[]): { year: number; month: number } | null {
  const r = readings.find((x) => x.reading.mes >= 1 && x.reading.mes <= 12 && x.reading.anio >= 2000)
  return r ? { year: r.reading.anio, month: r.reading.mes } : null
}

// Lectura sin API: Armando pega estas instrucciones en su chat de Claude junto con
// las fotos, y luego pega aquí la respuesta.
export function chatPrompt(): string {
  return `${VISION_PROMPT.replace('Esta imagen es una foto', 'Cada imagen adjunta es una foto')}

Formato de la respuesta: devuelve SOLO un bloque de código \`\`\`json con una lista que tenga un objeto por foto, en el mismo orden que las fotos. Sin texto antes ni después. Cada objeto tiene exactamente estos campos:
{
  "mes": número del 1 al 12 o 0,
  "anio": número o 0,
  "dias": [números de día de cada columna],
  "filas": [
    { "puesto": "texto", "nombre": "APELLIDOS, NOMBRE", "seccion": "", "turno_fijo": false, "celdas": ["N", "D", "", "L", ...], "dudosas": [índices] }
  ],
  "avisos": ["texto"]
}
No resumas ni abrevies: escribe todas las filas y todas las celdas. Si la respuesta no te cabe, escribe las fotos que quepan completas y avisa al final de cuáles faltan.`
}

const LenientReading = z.object({
  mes: z.coerce.number().int().catch(0),
  anio: z.coerce.number().int().catch(0),
  dias: z.array(z.coerce.number().int()),
  filas: z.array(
    z.object({
      puesto: z.coerce.string().catch(''),
      nombre: z.string(),
      seccion: z.string().catch(''),
      turno_fijo: z.boolean().catch(false),
      celdas: z.array(z.union([z.string(), z.null()]).transform((v) => v ?? '')),
      dudosas: z.array(z.coerce.number().int()).catch([]),
    }),
  ),
  avisos: z.array(z.string()).catch([]),
})

// Extrae las lecturas de la respuesta pegada (con o sin bloque de código, una foto o varias).
export function parsePastedReadings(text: string): Reading[] {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text
  const start = block.search(/[[{]/)
  const end = Math.max(block.lastIndexOf(']'), block.lastIndexOf('}'))
  if (start < 0 || end <= start) throw new Error('No encuentro la tabla en el texto pegado. Copia la respuesta completa de Claude.')
  let data: unknown
  try {
    data = JSON.parse(block.slice(start, end + 1))
  } catch {
    throw new Error('La respuesta está cortada o incompleta. Pide a Claude que la repita, o envía menos fotos en cada mensaje.')
  }
  const list = Array.isArray(data) ? data : [data]
  const out: Reading[] = []
  list.forEach((item, i) => {
    const r = LenientReading.safeParse(item)
    if (!r.success) throw new Error(`La foto ${i + 1} de la respuesta no tiene el formato esperado (faltan días, filas o celdas).`)
    out.push(r.data)
  })
  if (!out.some((r) => r.filas.length)) throw new Error('La respuesta no trae ninguna fila con nombre.')
  return out
}
