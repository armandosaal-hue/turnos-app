import { BLANK, type Kind, type Legend, type ShiftCode } from './types'

// Leyenda oficial del centro, tal como la facilitó Armando.
const OFFICIAL: [string, string][] = [
  ['A', 'AUSENCIAS'],
  ['Ai', 'AUSENCIAS INJUSTIFIC'],
  ['Aj', 'AUSENCIA JUSTIFICADA'],
  ['ALH', 'ACC.LABORAL HORAS'],
  ['Alp', 'ACC.LABORAL PARCIAL'],
  ['B', 'BAJA POR ENFERMEDAD'],
  ['BD', 'BAJA CON DESCANSO'],
  ['BL', 'BAJA CON LIBRES'],
  ['Bm', 'BAJA CON LIBRE DISPO'],
  ['BN', 'BAJA CON NOCHES'],
  ['Bt', 'BAJA CON LIBRE ANTIG'],
  ['BV', 'BAJA CON VACACIONES'],
  ['C', 'CESIÓN'],
  ['Ch', 'CRÉD. HOR. SINDICAL'],
  ['CJ', 'COMP. JORNADA'],
  ['Cs', 'CURSO EN SU TURNO'],
  ['CT', 'COMP. DE 35 A 37,5 H'],
  ['D', 'DESCANSO ( NOCHES )'],
  ['DJ', 'DIFERE.JORNADA'],
  ['E', 'PERM.JUST.HASTA 3 D.'],
  ['Ex', 'EXCEDENCIAS'],
  ['Fa', 'AUSENCIA CNT.FIC.'],
  ['FL', 'AUS.PER.LIB.CNT.FIC.'],
  ['Fr', 'FORMACIÓN'],
  ['Ft', 'FORMACIÓN TEÓRICA'],
  ['Fv', 'AUS. VAC. CNT.FIC.'],
  ['G', 'GUARDIA'],
  ['GF', 'GUARDIA FESTIVO'],
  ['Gs', 'GUARDIA LIBRE'],
  ['H', 'HORAS'],
  ['HH.', 'HUELGA HORAS'],
  ['Hu', 'HUELGA DÍAS'],
  ['Hut', 'HUELGA DÍAS TRANS.'],
  ['Hx', 'HORAS EXTRAS'],
  ['I', 'OTRAS INCIDENCIAS'],
  ['J', 'JUBILACIÓN'],
  ['L', 'LIBRE'],
  ['L*', 'LIBRE AÑO ANTERIOR'],
  ['La', 'LIBRE CON ALERTA'],
  ['Laa', 'LIB AÑO ANT(SIN AJU)'],
  ['Lac', 'LACTANCIA'],
  ['LF', 'LIBRE FESTIVOS'],
  ['Lh', 'LIBRE COMP. HORAS'],
  ['Lh*', 'L. COMP. H. AÑO ANT.'],
  ['Li', 'LIBRE DE SAN ISIDRO'],
  ['Lm', 'LIBRE DISPOSICIÓN'],
  ['Lr', 'LIBRE RECUPERABLE'],
  ['Ls', 'LIBERADO SINDICAL'],
  ['Lt', 'LIBRE POR ANTIGÜEDAD'],
  ['Lv', 'LIBRE VACACIONES'],
  ['Lvc', 'LIBRE VACACIONES'],
  ['/M', 'MEDIA JORNADA MAÑANA'],
  ['M', 'MATERNIDAD'],
  ['Ma', 'MAÑANA'],
  ['Mi', 'SERVICIOS MÍNIMOS'],
  ['MINI', 'SERVI. MÍNIMOS TRANS'],
  ['/N', 'MEDIA JORNADA NOCHE'],
  ['N', 'NOCHE'],
  ['NR', 'NO RETRIBUIDO'],
  ['Pc', 'PERMISOS RETRIBUIDOS'],
  ['Pch', 'PERMISO CONV.HORAS'],
  ['Ps', 'PERMISOS SIN SUELDO'],
  ['R', 'RECUPERADO'],
  ['Rj', 'COMP. JORNADA RED.'],
  ['RJes', 'RJ ESPECIAL'],
  ['RL', 'RECUPERACIÓN DE LIBR'],
  ['RV', 'RECUPERACIÓN VACAC.'],
  ['SB', 'ACCIDENTE SIN BAJA'],
  ['/T', 'MEDIA JORNADA TARDE'],
  ['T', 'TRABAJADO'],
  ['Taa', 'TRAB AÑO ANT(SIN AJ)'],
  ['TAU', 'TR.AUSENCIAS'],
  ['TBJ', 'TR. BAJA'],
  ['Td', 'TARDE'],
  ['TEXC', 'TR.EXCEDENCIA'],
  ['TFR', 'TR.FORMACION'],
  ['Th*', 'T. COMP. H. AÑO ANT.'],
  ['TJP', 'TRANS. JUBILADO PARC'],
  ['TOTR', 'TR.OTRAS SIT.'],
  ['TVC', 'TR.VACACIONES'],
  ['TxL', 'TRABAJO AÑO ANTERIOR'],
  ['V', 'VACACIONES'],
  ['VB', 'VACACIONES CON BAJA'],
  ['VLH', 'VACACIONES/LACTANCIA'],
  ['VT', 'VAC. TRBJADAS'],
  ['Vt', 'VAC. TRABAJADAS'],
  ['///', 'CESIÓN'],
  ['||', 'CESIÓN CON SERVICIOS MÍNIMOS EN HUELGA'],
  ['\\\\\\', 'SERVICIOS MÍNIMOS EN HUELGA'],
]

// Significados propios del Excel de la unidad, confirmados por Armando.
// Tienen prioridad sobre la leyenda oficial (allí M = maternidad y T = trabajado).
const UNIT: ShiftCode[] = [
  { code: BLANK, name: 'Diurno 12 h (celda vacía)', kind: 'trabajo', start: '08:00', end: '20:00', confirmed: true },
  { code: 'N', name: 'Noche 12 h', kind: 'trabajo', start: '20:00', end: '08:00', confirmed: true },
  { code: 'M', name: 'Mañana 7 h (oficial: maternidad)', kind: 'ocupado', start: '08:00', end: '15:00', confirmed: true },
  { code: 'T', name: 'Tarde 7 h (oficial: trabajado)', kind: 'ocupado', start: '15:00', end: '22:00', confirmed: true },
  { code: 'Ma', name: 'Mañana 7 h', kind: 'ocupado', start: '08:00', end: '15:00', confirmed: true },
  { code: 'Td', name: 'Tarde 7 h', kind: 'ocupado', start: '15:00', end: '22:00', confirmed: true },
  { code: 'D', name: 'Descanso (noches)', kind: 'libre', confirmed: true },
  { code: 'L', name: 'Libre', kind: 'libre', confirmed: true },
  { code: 'Lh', name: 'Libre comp. horas', kind: 'libre', confirmed: true },
]

// Códigos del Excel que no están en la leyenda oficial: no disponibles salvo aviso.
const UNIT_UNKNOWN = ['x', 'OPE', 'NO', '%', '12', '13', 'LC', '*', 'For', 'ur', 'uci', '.', 'n.']

export function defaultLegend(): Legend {
  const legend: Legend = {}
  for (const [code, name] of OFFICIAL) {
    legend[code] = { code, name: capitalize(name), kind: 'ausencia', confirmed: true }
  }
  for (const c of UNIT_UNKNOWN) {
    legend[c] = { code: c, name: 'Sin descripción', kind: 'ausencia', confirmed: true }
  }
  legend['∅'] = { code: '∅', name: 'Celda vacía en turno fijo (sin definir)', kind: 'ausencia', confirmed: true }
  for (const c of UNIT) legend[c.code] = { ...c }
  return legend
}

function capitalize(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase()
}

export function kindOf(legend: Legend, code: string): Kind {
  return legend[code]?.kind ?? 'ausencia'
}

export function codeLabel(legend: Legend, code: string | undefined): string {
  if (code === undefined) return 'sin datos'
  const name = legend[code]?.name
  if (code === BLANK) return 'diurno'
  return name ? `${code} · ${name.toLowerCase()}` : `${code} · sin definir`
}

export function displayCode(code: string): string {
  return code === BLANK ? '·' : code
}

// Sugerencia para un código desconocido: la misma clave sin distinguir mayúsculas.
export function suggestCode(legend: Legend, code: string): string | undefined {
  const lower = code.toLowerCase()
  return Object.keys(legend).find((k) => k !== code && k.toLowerCase() === lower)
}

// Tipo para el color en pantalla: separa diurno y noche, y el descanso que sigue a una noche.
export type VisualKind = 'diurno' | 'noche' | 'saliente' | 'libre' | 'ocupado' | 'ausencia' | 'none'

export function visualKind(legend: Legend, code: string | undefined, prevCode?: string, nightCode = 'N', restCode = 'D'): VisualKind {
  if (code === undefined) return 'none'
  const kind = kindOf(legend, code)
  if (kind === 'trabajo') {
    const { start, end } = legend[code] ?? {}
    return start && end && end <= start ? 'noche' : 'diurno'
  }
  if (kind === 'libre' && code === restCode && prevCode === nightCode) return 'saliente'
  return kind
}
