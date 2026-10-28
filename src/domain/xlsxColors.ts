import { strFromU8, unzipSync } from 'fflate'

// Color de relleno de la celda de la columna A de cada fila, por pestaña.
// En la plantilla de la unidad ese color marca el grupo de personas con el mismo ciclo.
export function readRowColors(data: Uint8Array): Record<string, Record<number, string>> {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data, { filter: (f) => f.name.startsWith('xl/') && f.name.endsWith('.xml') || f.name.endsWith('.rels') })
  } catch {
    return {}
  }
  const read = (name: string) => (files[name] ? strFromU8(files[name]) : '')
  const fills = parseFills(read('xl/styles.xml'))
  const sheets = sheetFiles(read('xl/workbook.xml'), read('xl/_rels/workbook.xml.rels'))
  const out: Record<string, Record<number, string>> = {}
  for (const [name, path] of Object.entries(sheets)) {
    const xml = read(path)
    if (!xml) continue
    const rows: Record<number, string> = {}
    for (const m of xml.matchAll(/<c\b[^>]*\br="A(\d+)"[^>]*>/g)) {
      const s = /\bs="(\d+)"/.exec(m[0])?.[1]
      const color = s !== undefined ? fills[Number(s)] : undefined
      if (color) rows[Number(m[1])] = color
    }
    out[name] = rows
  }
  return out
}

// Para cada estilo de celda (cellXfs), el color de su relleno sólido, si lo tiene.
function parseFills(styles: string): (string | undefined)[] {
  const fillsXml = /<fills[^>]*>([\s\S]*?)<\/fills>/.exec(styles)?.[1] ?? ''
  const fillColors = [...fillsXml.matchAll(/<fill>([\s\S]*?)<\/fill>|<fill\/>/g)].map((m) => {
    const f = m[1] ?? ''
    if (!/patternType="solid"/.test(f)) return undefined
    const fg = /<fgColor\b([^>]*)\/?>/.exec(f)?.[1] ?? ''
    const rgb = /\brgb="([0-9A-Fa-f]{8})"/.exec(fg)?.[1]
    if (rgb) return `#${rgb.slice(2).toUpperCase()}`
    const theme = /\btheme="(\d+)"/.exec(fg)?.[1]
    if (theme !== undefined) return `theme${theme}${/\btint="([-\d.]+)"/.exec(fg)?.[1] ?? ''}`
    const idx = /\bindexed="(\d+)"/.exec(fg)?.[1]
    return idx !== undefined && idx !== '64' ? `indexed${idx}` : undefined
  })
  const xfsXml = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? ''
  return [...xfsXml.matchAll(/<xf\b([^>]*)\/?>/g)].map((m) => {
    const id = /\bfillId="(\d+)"/.exec(m[1])?.[1]
    return id !== undefined ? fillColors[Number(id)] : undefined
  })
}

function sheetFiles(workbook: string, rels: string): Record<string, string> {
  const targets: Record<string, string> = {}
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[1])?.[1]
    const target = /\bTarget="([^"]+)"/.exec(m[1])?.[1]
    if (id && target) targets[id] = target.startsWith('/') ? target.slice(1) : `xl/${target}`
  }
  const out: Record<string, string> = {}
  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = /\bname="([^"]+)"/.exec(m[1])?.[1]
    const rid = /\br:id="([^"]+)"/.exec(m[1])?.[1]
    if (name && rid && targets[rid]) out[decodeXml(name)] = targets[rid]
  }
  return out
}

function decodeXml(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

// Blanco, gris o negro no marcan grupo; solo los colores.
export function isGroupColor(c: string | undefined): c is string {
  if (!c) return false
  if (!c.startsWith('#')) return true
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
  return Math.max(r, g, b) - Math.min(r, g, b) > 20
}

// Nombre aproximado del color para mostrarlo ("amarillo", "verde oscuro"…).
export function colorName(c: string): string {
  if (!c.startsWith('#')) return 'color'
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d < 0.08) return l > 0.8 ? 'gris claro' : l > 0.4 ? 'gris' : 'negro'
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  const base =
    h < 15 || h >= 345 ? 'rojo' : h < 40 ? 'naranja' : h < 70 ? 'amarillo' : h < 160 ? 'verde' : h < 200 ? 'celeste' : h < 250 ? 'azul' : h < 290 ? 'morado' : 'rosa'
  if (base === 'rojo' && l > 0.6) return 'salmón'
  if (l < 0.35) return `${base} oscuro`
  if (l > 0.85) return `${base} claro`
  return base
}
