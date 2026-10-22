// Lectura del texto de la dieta y cálculo de gramos por alimento.

export const COMIDAS = ['desayuno', 'comida', 'merienda', 'cena']
export const NOMBRE_COMIDA = { desayuno: 'Desayuno', comida: 'Comida', merienda: 'Merienda', cena: 'Cena' }
export const MACROS = ['hc', 'p', 'g']
export const KCAL = { hc: 4, p: 4, g: 9 }

const CLAVES_COMIDA = [
  ['desayuno', 'desayuno'],
  ['merienda', 'merienda'],
  ['cena', 'cena'],
  ['comida', 'comida'],
  ['almuerzo', 'comida'],
]

// Etiquetas aceptadas para cada macro, de la más larga a la más corta.
const ETIQUETAS = [
  ['hidratos de carbono', 'hc'],
  ['carbohidratos', 'hc'],
  ['hidratos', 'hc'],
  ['carbos', 'hc'],
  ['carbs', 'hc'],
  ['hdc', 'hc'],
  ['cho', 'hc'],
  ['hc', 'hc'],
  ['ch', 'hc'],
  ['proteinas', 'p'],
  ['proteina', 'p'],
  ['prot', 'p'],
  ['p', 'p'],
  ['grasas', 'g'],
  ['grasa', 'g'],
  ['lipidos', 'g'],
  ['g', 'g'],
]
const ETIQUETA = ETIQUETAS.map(([e]) => e.replace(/ /g, '\\s+')).join('|')
const NUM = '(\\d+(?:[.,]\\d+)?)'
const UNIDAD = '(?:\\s*(?:gramos|grs|gr|g)\\b\\.?)?'
const RE_ETIQUETA_NUM = new RegExp(`\\b(${ETIQUETA})\\b\\s*[:=\\-]?\\s*${NUM}`, 'g')
const RE_NUM_ETIQUETA = new RegExp(`${NUM}${UNIDAD}\\s*(?:de\\s+)?\\b(${ETIQUETA})\\b`, 'g')

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function macroDe(etiqueta) {
  const limpia = etiqueta.replace(/\s+/g, ' ')
  const par = ETIQUETAS.find(([e]) => e === limpia)
  return par ? par[1] : null
}

const numero = (s) => Number(s.replace(',', '.'))

function buscar(tramo, re, numeroPrimero) {
  const macros = {}
  for (const m of tramo.matchAll(re)) {
    const [etq, num] = numeroPrimero ? [m[2], m[1]] : [m[1], m[2]]
    const macro = macroDe(etq)
    if (macro && macros[macro] === undefined) macros[macro] = numero(num)
  }
  return macros
}

// Prueba "HC 60" y "60 HC"; se queda con la lectura que reconoce más macros.
function leerTramo(tramo) {
  const etiquetaPrimero = buscar(tramo, RE_ETIQUETA_NUM, false)
  const numeroPrimero = buscar(tramo, RE_NUM_ETIQUETA, true)
  const macros =
    Object.keys(numeroPrimero).length > Object.keys(etiquetaPrimero).length ? numeroPrimero : etiquetaPrimero
  if (Object.keys(macros).length > 0) return { macros, sinEtiquetas: false }
  // Sin etiquetas: tres números seguidos se leen como HC, proteína y grasa.
  const nums = [...tramo.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => numero(m[0]))
  if (nums.length === 3) return { macros: { hc: nums[0], p: nums[1], g: nums[2] }, sinEtiquetas: true }
  return { macros, sinEtiquetas: false }
}

// Devuelve { dieta: {desayuno: {hc,p,g}, ...}, avisos: [texto] }.
export function leerDieta(texto) {
  const t = normalizar(texto)
  const marcas = []
  for (const [clave, comida] of CLAVES_COMIDA) {
    const re = new RegExp(`\\b${clave}\\b`, 'g')
    for (const m of t.matchAll(re)) marcas.push({ pos: m.index, fin: m.index + clave.length, comida })
  }
  marcas.sort((a, b) => a.pos - b.pos)

  const dieta = {}
  const avisos = []
  marcas.forEach((marca, i) => {
    if (dieta[marca.comida]) return
    const tramo = t.slice(marca.fin, i + 1 < marcas.length ? marcas[i + 1].pos : t.length)
    const { macros, sinEtiquetas } = leerTramo(tramo)
    if (Object.keys(macros).length === 0) return
    dieta[marca.comida] = { hc: macros.hc ?? 0, p: macros.p ?? 0, g: macros.g ?? 0 }
    const faltan = MACROS.filter((k) => macros[k] === undefined)
    if (faltan.length) avisos.push(`${NOMBRE_COMIDA[marca.comida]}: no encuentro ${faltan.map(nombreMacro).join(' ni ')}; queda a 0.`)
    if (sinEtiquetas) avisos.push(`${NOMBRE_COMIDA[marca.comida]}: números sin etiqueta, leídos en orden HC, proteína, grasa.`)
  })
  for (const c of COMIDAS) if (!dieta[c]) avisos.push(`No encuentro ${NOMBRE_COMIDA[c].toLowerCase()} en el texto.`)
  return { dieta, avisos }
}

export function nombreMacro(m) {
  return { hc: 'hidratos', p: 'proteína', g: 'grasa' }[m]
}

export function kcal(m) {
  return m.hc * KCAL.hc + m.p * KCAL.p + m.g * KCAL.g
}

export function macrosDe(alimento, gramos) {
  return { hc: (alimento.hc * gramos) / 100, p: (alimento.p * gramos) / 100, g: (alimento.g * gramos) / 100 }
}

function sumar(lista) {
  return lista.reduce((a, m) => ({ hc: a.hc + m.hc, p: a.p + m.p, g: a.g + m.g }), { hc: 0, p: 0, g: 0 })
}

// Resuelve A·x = b por mínimos cuadrados (ecuaciones normales, eliminación gaussiana).
function minimosCuadrados(columnas, b) {
  const n = columnas.length
  const M = columnas.map((ci) => [...columnas.map((cj) => ci.reduce((s, v, k) => s + v * cj[k], 0)), ci.reduce((s, v, k) => s + v * b[k], 0)])
  for (let i = 0; i < n; i++) {
    let piv = i
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r
    if (Math.abs(M[piv][i]) < 1e-12) return null
    ;[M[i], M[piv]] = [M[piv], M[i]]
    for (let r = 0; r < n; r++) {
      if (r === i) continue
      const f = M[r][i] / M[i][i]
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]
    }
  }
  return M.map((fila, i) => fila[n] / fila[i])
}

// Gramos de cada alimento (no negativos) que mejor cuadran los tres macros del objetivo.
// El error se pondera en kcal (4, 4, 9) para que un gramo de grasa pese más que uno de hidratos.
export function calcularGramos(objetivo, alimentos) {
  const w = MACROS.map((k) => Math.sqrt(KCAL[k]))
  const cols = alimentos.map((a) => MACROS.map((k, i) => (a[k] / 100) * w[i]))
  const b = MACROS.map((k, i) => objetivo[k] * w[i])
  let mejor = { x: alimentos.map(() => 0), error: b.reduce((s, v) => s + v * v, 0) }
  const n = alimentos.length
  for (let mascara = 1; mascara < 1 << n; mascara++) {
    const idx = [...Array(n).keys()].filter((i) => mascara & (1 << i))
    const sol = minimosCuadrados(idx.map((i) => cols[i]), b)
    if (!sol || sol.some((v) => v < -1e-9)) continue
    const x = alimentos.map(() => 0)
    idx.forEach((i, j) => (x[i] = Math.max(0, sol[j])))
    const error = MACROS.reduce((s, _, k) => {
      const r = b[k] - cols.reduce((t, c, i) => t + c[k] * x[i], 0)
      return s + r * r
    }, 0)
    if (error < mejor.error - 1e-9) mejor = { x, error }
  }
  return mejor.x
}

// Gramos prácticos: de 1 en 1 por debajo de 30 g, de 5 en 5 por encima.
export function redondear(gramos) {
  if (gramos < 0.5) return 0
  return gramos < 30 ? Math.round(gramos) : Math.round(gramos / 5) * 5
}

// ---------- Equivalencias por macro principal ----------

// Gramos de un alimento que aportan `objetivoMacro` gramos del macro `macro`.
// Devuelve también el peso cocido (si hay datos), la medida casera y lo que aporta de los otros macros.
export function equivalencia(alimento, macro, objetivoMacro) {
  if (!(objetivoMacro > 0) || !(alimento[macro] > 0)) return null
  const gramos = (objetivoMacro * 100) / alimento[macro]
  const r = { gramos: redondear(gramos), exacto: gramos }
  if (alimento.cocido && alimento.cocido[macro] > 0) r.cocido = redondear((objetivoMacro * 100) / alimento.cocido[macro])
  if (alimento.medida) r.medidas = gramos / alimento.medida.g
  const aporte = macrosDe(alimento, gramos)
  r.extra = Object.fromEntries(MACROS.filter((k) => k !== macro).map((k) => [k, aporte[k]]))
  return r
}

// Lista de equivalencias de un grupo, incluidos los alimentos que también cuentan en ese grupo.
export function equivalencias(alimentos, macro, objetivoMacro) {
  return alimentos
    .filter((a) => a.grupo === macro || a.tambien === macro)
    .map((a) => ({ alimento: a, secundario: a.grupo !== macro, eq: equivalencia(a, macro, objetivoMacro) }))
    .filter((x) => x.eq)
}

// Texto de la medida casera: "≈ 2 rebanadas", "≈ 1,5 huevos L".
export function textoMedida(medida, cantidad) {
  if (!medida || !(cantidad > 0)) return ''
  const n = cantidad < 10 ? Math.round(cantidad * 2) / 2 : Math.round(cantidad)
  if (n === 0) return `menos de ½ ${medida.nombre}`
  const plural = n === 1 ? medida.nombre : PLURALES[medida.nombre] || medida.nombre + 's'
  return `≈ ${String(n).replace('.', ',')} ${plural}`
}

// Volumen de un líquido: "≈ 290 ml (1,2 vasos de 250 ml)". Solo para alimentos con densidad (`ml`, en g/ml).
export const VASO_ML = 250
export function textoVolumen(alimento, gramos) {
  if (!alimento.ml || !(gramos > 0)) return ''
  const ml = gramos / alimento.ml
  const redondo = ml < 30 ? Math.round(ml) : Math.round(ml / 5) * 5
  if (ml < 100) return `≈ ${redondo} ml`
  const vasos = Math.round((ml / VASO_ML) * 10) / 10
  return `≈ ${redondo} ml (${String(vasos).replace('.', ',')} ${vasos === 1 ? 'vaso' : 'vasos'} de ${VASO_ML} ml)`
}

const PLURALES = {
  'plátano mediano': 'plátanos medianos',
  'manzana mediana': 'manzanas medianas',
  'mandarina mediana': 'mandarinas medianas',
  'dátil sin hueso': 'dátiles sin hueso',
  'huevo L': 'huevos L',
  'clara de huevo L': 'claras de huevo L',
  'aguacate entero': 'aguacates enteros',
  flan: 'flanes',
  natillas: 'natillas',
  yogur: 'yogures',
}

// ---------- Postres ----------

// Gramos de un postre según cómo se haya anotado (unidades del envase o gramos).
export function gramosPostre(alimento, item) {
  if (item.modo === 'unidad' && alimento.medida) return item.cantidad * alimento.medida.g
  return item.cantidad
}

// Lo que queda de la comida después de restar los postres. `exceso` indica el macro que el postre supera.
export function restarPostres(objetivo, postres) {
  const total = sumar(postres.map(({ alimento, gramos }) => macrosDe(alimento, gramos)))
  const resta = {}
  const exceso = {}
  for (const k of MACROS) {
    const r = objetivo[k] - total[k]
    resta[k] = Math.max(0, r)
    if (r < -0.5) exceso[k] = -r
  }
  return { postre: total, resta, exceso }
}

// ---------- Plato ----------

// Resuelve A·x = b (A cuadrada) por eliminación gaussiana. Devuelve null si es singular.
function resolver(A, b) {
  const n = b.length
  const M = A.map((fila, i) => [...fila, b[i]])
  for (let i = 0; i < n; i++) {
    let piv = i
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r
    if (Math.abs(M[piv][i]) < 1e-12) return null
    ;[M[i], M[piv]] = [M[piv], M[i]]
    for (let r = 0; r < n; r++) {
      if (r === i) continue
      const f = M[r][i] / M[i][i]
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]
    }
  }
  return M.map((fila, i) => fila[n] / fila[i])
}

// Gramos de los alimentos automáticos de un plato.
// `fijos`: [{alimento, gramos}] (postres y cantidades que el usuario ha fijado).
// `autos`: [{alimento, grupo}]: cada uno cubre su macro `grupo`; si hay varios del mismo grupo, se lo reparten a partes iguales.
// Lo que aportan los demás alimentos a ese macro se descuenta. Si a un grupo no le queda nada, sus alimentos van a 0 g.
export function ajustarPlato(objetivo, fijos, autos) {
  const base = sumar(fijos.map(({ alimento, gramos }) => macrosDe(alimento, gramos)))
  const x = autos.map(() => 0)
  let activos = autos.map((_, i) => i)
  for (let vuelta = 0; vuelta <= autos.length && activos.length; vuelta++) {
    const n = activos.length
    const A = activos.map(() => Array(n).fill(0))
    const b = Array(n).fill(0)
    activos.forEach((i, fila) => {
      const k = autos[i].grupo
      const mismos = activos.filter((j) => autos[j].grupo === k)
      // macro_k(i)·x_i = (objetivo_k − fijos_k − Σ macro_k(j)·x_j de otros grupos) / nº de alimentos del grupo
      A[fila][fila] = (autos[i].alimento[k] / 100) * mismos.length
      activos.forEach((j, col) => {
        if (autos[j].grupo !== k) A[fila][col] += autos[j].alimento[k] / 100
      })
      b[fila] = objetivo[k] - base[k]
    })
    const sol = resolver(A, b)
    if (!sol) break
    const negativos = activos.filter((_, f) => sol[f] < 0)
    activos.forEach((i, f) => (x[i] = Math.max(0, sol[f])))
    if (!negativos.length) break
    // El que más se pasa de negativo se queda a 0 y se vuelve a resolver con el resto.
    const peor = negativos.reduce((a, i) => (sol[activos.indexOf(i)] < sol[activos.indexOf(a)] ? i : a))
    x[peor] = 0
    activos = activos.filter((i) => i !== peor)
  }
  return x
}

// Plato completo con gramos redondeados (lo que se pesa), total, lo que queda y exceso.
export function resumenPlato(objetivo, fijos, autos) {
  const gramos = ajustarPlato(objetivo, fijos, autos).map(redondear)
  const total = sumar([
    ...fijos.map(({ alimento, gramos: g }) => macrosDe(alimento, g)),
    ...autos.map(({ alimento }, i) => macrosDe(alimento, gramos[i])),
  ])
  const resta = {}
  const exceso = {}
  for (const k of MACROS) {
    const r = objetivo[k] - total[k]
    resta[k] = Math.max(0, r)
    if (r < -2) exceso[k] = -r
  }
  return { gramos, total, resta, exceso }
}

// Propuesta completa para un objetivo y tres alimentos elegidos.
export function proponer(objetivo, alimentos) {
  const gramos = calcularGramos(objetivo, alimentos).map(redondear)
  const total = sumar(alimentos.map((a, i) => macrosDe(a, gramos[i])))
  const diferencia = { hc: total.hc - objetivo.hc, p: total.p - objetivo.p, g: total.g - objetivo.g }
  return { gramos, total, diferencia }
}
