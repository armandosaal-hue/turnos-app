import { ALIMENTOS } from './alimentos.js'
import {
  COMIDAS, NOMBRE_COMIDA, MACROS, leerDieta, kcal, nombreMacro, redondear,
  equivalencias, textoMedida, textoVolumen, gramosPostre, restarPostres, macrosDe, resumenPlato,
} from './logic.js'

const CLAVE = 'mi-dieta-v2'
const EJEMPLO = {
  desayuno: { hc: 60, p: 30, g: 15 },
  comida: { hc: 80, p: 45, g: 20 },
  merienda: { hc: 30, p: 25, g: 10 },
  cena: { hc: 50, p: 40, g: 15 },
}
const CON_POSTRE = ['comida', 'cena']
const GRUPO = { hc: 'Hidratos', p: 'Proteína', g: 'Grasa' }
const CADENAS = { generico: 'Genéricos', mercadona: 'Mercadona', ahorramas: 'Ahorramas', lidl: 'Lidl', alcampo: 'Alcampo', propio: 'Míos' }
// ---------- Estado ----------
function cargar() {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) || 'null')
    if (s && typeof s === 'object') return s
    const viejo = JSON.parse(localStorage.getItem('mi-dieta-v1') || 'null')
    if (viejo && viejo.dieta) return { dieta: viejo.dieta, texto: viejo.texto || '' }
  } catch {}
  return {}
}
const estado = Object.assign(
  { dieta: null, texto: '', comida: 'comida', grupo: 'hc', cadena: 'todos', favoritos: [], postres: {}, plato: {}, propios: [], vista: 'equiv' },
  cargar(),
)
function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado))
  } catch {}
}

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('es-ES')
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const todos = () => [...ALIMENTOS, ...estado.propios]
const porId = (id) => todos().find((a) => a.id === id)
const dieta = () => estado.dieta || EJEMPLO
const cadenaDe = (a) => a.cadena || (a.propio ? 'propio' : 'generico')
const esFav = (id) => estado.favoritos.includes(id)

function postresDe(comida) {
  if (!CON_POSTRE.includes(comida)) return []
  return (estado.postres[comida] || []).map((it) => ({ it, alimento: porId(it.id) })).filter((x) => x.alimento)
}

// ---------- Cabecera ----------
function pintarComidas() {
  const d = dieta()
  $('meals').innerHTML = COMIDAS.map(
    (c) => `<button class="meal" data-comida="${c}" aria-pressed="${c === estado.comida}">${NOMBRE_COMIDA[c]}<small>${Math.round(kcal(d[c]))} kcal</small></button>`,
  ).join('')
  const total = COMIDAS.reduce((s, c) => s + kcal(d[c]), 0)
  $('sub').textContent = `${Math.round(total)} kcal al día`
  $('banner-ejemplo').hidden = !!estado.dieta
}
$('meals').addEventListener('click', (e) => {
  const b = e.target.closest('[data-comida]')
  if (!b) return
  estado.comida = b.dataset.comida
  guardar()
  pintar()
})
$('ir-cargar').addEventListener('click', () => mostrar('dieta'))

// ---------- Plato de la comida ----------
// Elementos del plato: [{ id, grupo, fijo }]. `grupo` es el macro que cubre; `fijo` son gramos puestos a mano.
function platoDe(comida) {
  return (estado.plato[comida] || []).map((it) => ({ it, alimento: porId(it.id) })).filter((x) => x.alimento)
}

// Situación de la comida con unos elementos dados (sirve también para simular un alimento nuevo).
function calcular(items, postres) {
  const objetivo = dieta()[estado.comida]
  const fijos = [
    ...postres.map(({ it, alimento }) => ({ alimento, gramos: gramosPostre(alimento, it) })),
    ...items.filter(({ it }) => it.fijo != null).map(({ it, alimento }) => ({ alimento, gramos: it.fijo })),
  ]
  const autosIdx = items.map((x, i) => (x.it.fijo == null ? i : -1)).filter((i) => i >= 0)
  const autos = autosIdx.map((i) => ({ alimento: items[i].alimento, grupo: items[i].it.grupo }))
  const r = resumenPlato(objetivo, fijos, autos)
  const gramos = items.map(({ it }) => it.fijo)
  autosIdx.forEach((i, j) => (gramos[i] = r.gramos[j]))
  const postre = postres.length ? restarPostres(objetivo, fijos.slice(0, postres.length)).postre : { hc: 0, p: 0, g: 0 }
  return { objetivo, ...r, gramos, postre }
}

function situacion() {
  return calcular(platoDe(estado.comida), postresDe(estado.comida))
}

// Casillas de resumen: llevas X de Y, barra y lo que queda.
function resumen(objetivo, total) {
  const casilla = (clase, etiqueta, lleva, meta, unidad) => {
    const dif = meta - lleva
    const pct = meta > 0 ? Math.min(100, (lleva / meta) * 100) : 0
    const queda = Math.abs(dif) < (unidad === 'kcal' ? 15 : 2) ? '<span class="queda ok">cuadrado</span>'
      : dif > 0 ? `<span class="queda">quedan ${fmt(dif, unidad === 'kcal' ? 0 : 1)}${unidad === 'kcal' ? '' : ' g'}</span>`
      : `<span class="queda off">+${fmt(-dif, unidad === 'kcal' ? 0 : 1)}${unidad === 'kcal' ? '' : ' g'} de más</span>`
    return `<div class="macro ${clase}"><span class="label">${etiqueta}</span><b>${fmt(lleva, unidad === 'kcal' ? 0 : 1)}</b><span class="de">de ${fmt(meta, 0)} ${unidad}</span>
      <div class="bar-wrap"><div class="fill" style="width:${pct}%"></div></div>${queda}</div>`
  }
  return MACROS.map((k) => casilla(k, GRUPO[k], total[k], objetivo[k], 'g')).join('') + casilla('', 'Energía', kcal(total), kcal(objetivo), 'kcal')
}

function pintarEquiv() {
  const s = situacion()
  $('obj-titulo').textContent = `Llevas en ${estado.comida === 'desayuno' ? 'el' : 'la'} ${NOMBRE_COMIDA[estado.comida].toLowerCase()}`
  $('obj-kcal').textContent = ''
  $('objetivo').innerHTML = resumen(s.objetivo, s.total)
  $('mini').innerHTML =
    'Llevas ' +
    MACROS.map((k) => `<span class="${k}">${k === 'hc' ? 'HC' : k.toUpperCase()} ${fmt(s.total[k], 0)}/${fmt(s.objetivo[k], 0)}</span>`).join('') +
    `<span>${Math.round(kcal(s.total))}/${Math.round(kcal(s.objetivo))} kcal</span>`
  const ex = Object.entries(s.exceso)
  $('exceso').hidden = !ex.length
  $('exceso').textContent = ex.length
    ? `Te pasas de ${ex.map(([k, v]) => `${nombreMacro(k)} en ${fmt(v)} g`).join(' y ')}. Quita o cambia algún alimento, o baja la cantidad de uno fijado.`
    : ''

  const conPostre = CON_POSTRE.includes(estado.comida)
  $('panel-postre').hidden = !conPostre
  if (conPostre) pintarPostres(s)
  pintarPlato(s)

  const resta = s.resta
  const cuantas = Object.fromEntries(MACROS.map((k) => [k, equivalencias(todos(), k, 1).length]))
  $('tabs').innerHTML =
    `<button class="tab todos" role="tab" data-grupo="todos" aria-selected="${estado.grupo === 'todos'}">Todos<small>buscador</small><small class="n">${opcionesTodos().length} alimentos</small></button>` +
    MACROS.map(
      (k) => `<button class="tab ${k}" role="tab" data-grupo="${k}" aria-selected="${k === estado.grupo}">${GRUPO[k]}<small>${resta[k] > 0.5 ? `quedan ${fmt(resta[k])} g` : 'cubierto'}</small><small class="n">${cuantas[k]} opciones</small></button>`,
    ).join('')

  const opciones = ['todos', 'favoritos', ...Object.keys(CADENAS).filter((c) => c !== 'propio' || estado.propios.length)]
  $('cadenas').innerHTML = opciones
    .map((c) => `<button class="chip" data-cadena="${c}" aria-pressed="${c === estado.cadena}">${c === 'todos' ? 'Todos' : c === 'favoritos' ? '★ Favoritos' : CADENAS[c]}</button>`)
    .join('')
  pintarLista()
}

function pintarPlato(s) {
  const items = platoDe(estado.comida)
  $('plato-vacio').hidden = items.length > 0
  $('vaciar').hidden = !items.length
  $('plato').innerHTML = items
    .map(({ it, alimento: a }, i) => {
      const g = s.gramos[i]
      const m = macrosDe(a, g)
      const sub = [
        a.cocido && a.cocido[it.grupo] > 0 && g > 0 ? `cocido ≈ ${redondear((g * a[it.grupo]) / a.cocido[it.grupo])} g` : '',
        a.medida && g > 0 ? textoMedida(a.medida, g / a.medida.g) : '',
        textoVolumen(a, g),
      ].filter(Boolean)
      const etiqueta = a.cocido ? a.estado || 'seco' : 'g'
      return `<div class="dish">
        <span class="bar ${it.grupo}"></span>
        <div class="name"><b>${esc(a.nombre)}</b>
          <span class="meta">${cadenaDe(a) !== 'generico' ? `<span class="tag">${CADENAS[cadenaDe(a)]}</span>` : ''}<span>${fmt(m.p)} P · ${fmt(m.hc)} HC · ${fmt(m.g)} G · ${Math.round(kcal(m))} kcal</span></span></div>
        <div><div class="grams">${fmt(g, 0)}<small>${esc(etiqueta)}</small></div>${sub.map((t) => `<div class="sub">${esc(t)}</div>`).join('')}</div>
        <div class="dish-ctl">
          <button class="mini" data-pmenos="${i}" aria-label="Menos">− 5 g</button>
          <button class="mini" data-pmas="${i}" aria-label="Más">+ 5 g</button>
          ${it.fijo != null ? `<span class="badge fijo">fijado</span><button class="mini" data-pauto="${i}">Ajustar solo</button>` : '<span class="badge">ajustado</span>'}
          <button class="mini rm" data-pquitar="${i}">Quitar</button>
        </div>
      </div>`
    })
    .join('')
}

$('plato').addEventListener('click', (e) => {
  const b = e.target.closest('button')
  if (!b) return
  const lista = estado.plato[estado.comida] || []
  const s = situacion()
  const i = Number(b.dataset.pmenos ?? b.dataset.pmas ?? b.dataset.pauto ?? b.dataset.pquitar)
  const it = lista[i]
  if (!it) return
  if (b.dataset.pquitar !== undefined) lista.splice(i, 1)
  else if (b.dataset.pauto !== undefined) it.fijo = null
  else {
    const actual = s.gramos[i] || 0
    it.fijo = Math.max(0, Math.round(actual / 5) * 5 + (b.dataset.pmas !== undefined ? 5 : -5))
  }
  estado.plato[estado.comida] = lista
  guardar()
  pintar()
})
$('vaciar').addEventListener('click', () => {
  estado.plato[estado.comida] = []
  guardar()
  pintar()
})

// Pestaña «Todos»: cada alimento con su grupo principal (los postres genéricos van en su hoja).
function opcionesTodos() {
  return todos().filter((a) => MACROS.includes(a.grupo)).map((a) => ({ alimento: a, secundario: false }))
}

function pintarLista() {
  const k = estado.grupo
  const enTodos = k === 'todos'
  const items = platoDe(estado.comida)
  const postres = postresDe(estado.comida)
  const s = calcular(items, postres)
  const q = norm($('buscar').value.trim())
  const base = enTodos ? opcionesTodos() : equivalencias(todos(), k, 1)
  let filas = base.filter(({ alimento: a }) => {
    if (estado.cadena === 'favoritos' && !esFav(a.id)) return false
    if (!['todos', 'favoritos'].includes(estado.cadena) && cadenaDe(a) !== estado.cadena) return false
    return !q || norm(`${a.nombre} ${CADENAS[cadenaDe(a)]}`).includes(q)
  })
  // Favoritos arriba; los alimentos que cuentan sobre todo en otro grupo, al final.
  const rango = (f) => (esFav(f.alimento.id) ? 0 : f.secundario ? 2 : 1)
  filas = [0, 1, 2].flatMap((r) => filas.filter((f) => rango(f) === r))
  const enPlato = new Set(items.map(({ it }) => it.id))
  const html = filas.map(({ alimento: a, secundario }) => {
    const gk = enTodos ? a.grupo : k
    // Simula el plato con este alimento añadido para saber cuántos gramos le tocarían.
    const sim = enPlato.has(a.id) ? null : calcular([...items, { it: { id: a.id, grupo: gk, fijo: null }, alimento: a }], postres)
    const g = sim ? sim.gramos[sim.gramos.length - 1] : null
    return filaOpcion(a, gk, secundario, g, enPlato.has(a.id), enTodos)
  })
  const cubierto = !enTodos && s.resta[k] <= 0.5
  $('lista').innerHTML = html.length
    ? (cubierto ? `<div class="covered">Ya tienes cubiertos los ${GRUPO[k].toLowerCase()} de esta comida.</div>` : '') + html.join('')
    : `<div class="empty">${estado.cadena === 'favoritos' ? 'Aún no tienes favoritos. Toca la estrella de un alimento para tenerlo arriba.' : 'No hay alimentos con ese filtro.'}</div>`
  $('nota-lista').textContent = enTodos
    ? `${filas.length} alimentos. Cada uno cuenta en su grupo principal (hidratos, proteína o grasa). Los gramos son los que le tocarían si lo añades ahora.`
    : `${filas.length} opciones de ${GRUPO[k].toLowerCase()}. Los gramos son los que le tocarían si lo añades ahora, ya reajustado con lo que tienes en el plato.`
}

function filaOpcion(a, k, secundario, g, yaEsta, conGrupo = false) {
  const cad = cadenaDe(a)
  const m = g ? macrosDe(a, g) : null
  const otros = m
    ? MACROS.filter((x) => x !== k && m[x] >= 0.5).map((x) => `${fmt(m[x], 0)} g ${x === 'hc' ? 'HC' : x === 'p' ? 'prot.' : 'grasa'}`).join(' · ')
    : ''
  const meta = [
    a.estado && !a.cocido ? esc(a.estado) : '',
    conGrupo ? `<span class="tag grupo ${k}">${GRUPO[k]}</span>` : '',
    cad !== 'generico' ? `<span class="tag">${CADENAS[cad]}</span>` : '',
    secundario ? `<span class="tag also">cuenta como ${GRUPO[a.grupo].toLowerCase()}</span>` : '',
    otros ? `<span>también ${otros}</span>` : '',
  ].filter(Boolean).join('')
  const etiqueta = a.cocido ? a.estado || 'seco' : 'g'
  const lineas = g
    ? [
        a.cocido && a.cocido[k] > 0 ? `<span class="cooked">cocido ≈ ${redondear((g * a[k]) / a.cocido[k])} g</span>` : '',
        a.medida ? `<span>${esc(textoMedida(a.medida, g / a.medida.g))}</span>` : '',
        a.ml ? `<span>${esc(textoVolumen(a, g))}</span>` : '',
      ].join('')
    : ''
  const cantidad = yaEsta ? '<span>en el plato</span>' : g ? `<b>${g}<small>${esc(etiqueta)}</small></b>${lineas}` : '<span>no hace falta</span>'
  return `<div class="item">
    <button class="star" data-fav="${esc(a.id)}" aria-pressed="${esFav(a.id)}" aria-label="Favorito">★</button>
    <div class="info"><b>${esc(a.nombre)}</b><div class="meta">${meta}</div></div>
    <div class="amount">${cantidad}<button class="addbtn" data-add="${esc(a.id)}" data-addgrupo="${k}" ${yaEsta ? 'disabled' : ''}>${yaEsta ? '✓' : '+ Añadir'}</button></div>
  </div>`
}

$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-grupo]')
  if (!b) return
  estado.grupo = b.dataset.grupo
  guardar()
  pintarEquiv()
})
$('cadenas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cadena]')
  if (!b) return
  estado.cadena = b.dataset.cadena
  guardar()
  pintarEquiv()
})
$('buscar').addEventListener('input', pintarLista)
$('lista').addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]')
  if (add) {
    const lista = estado.plato[estado.comida] || []
    lista.push({ id: add.dataset.add, grupo: add.dataset.addgrupo, fijo: null })
    estado.plato[estado.comida] = lista
    guardar()
    pintar()
    return
  }
  const b = e.target.closest('[data-fav]')
  if (!b) return
  const id = b.dataset.fav
  estado.favoritos = esFav(id) ? estado.favoritos.filter((x) => x !== id) : [...estado.favoritos, id]
  guardar()
  pintarLista()
})

// ---------- Postres ----------
function pintarPostres(s) {
  const items = postresDe(estado.comida)
  $('postres').innerHTML = items
    .map(({ it, alimento: a }, i) => {
      const g = gramosPostre(a, it)
      const m = macrosDe(a, g)
      const cant = it.modo === 'unidad' ? `${fmt(it.cantidad)} × ${a.medida.nombre}` : a.ml ? `${Math.round(it.cantidad / a.ml)} ml` : `${it.cantidad} g`
      return `<div class="dessert">
        <div class="name"><b>${esc(a.nombre)}</b><span>${cadenaDe(a) !== 'generico' ? CADENAS[cadenaDe(a)] + ' · ' : ''}${fmt(m.p)} P · ${fmt(m.hc)} HC · ${fmt(m.g)} G</span></div>
        <div class="qty"><button data-menos="${i}" aria-label="Menos">−</button><output>${cant}</output><button data-mas="${i}" aria-label="Más">+</button></div>
        <button class="rm" data-quitar="${i}">Quitar</button>
      </div>`
    })
    .join('')
  $('postre-total').textContent = items.length ? `${Math.round(kcal(s.postre))} kcal` : 'Opcional'
}

$('postres').addEventListener('click', (e) => {
  const lista = estado.postres[estado.comida] || []
  const b = e.target.closest('button')
  if (!b) return
  const i = Number(b.dataset.menos ?? b.dataset.mas ?? b.dataset.quitar)
  const it = lista[i]
  if (!it) return
  const paso = it.modo === 'unidad' ? 0.5 : 25
  if (b.dataset.quitar !== undefined) lista.splice(i, 1)
  else if (b.dataset.mas !== undefined) it.cantidad += paso
  else it.cantidad = Math.max(paso, it.cantidad - paso)
  estado.postres[estado.comida] = lista
  guardar()
  pintar()
})

let cadenaPostre = 'todos'
function abrirPostres() {
  $('sheet').hidden = false
  $('buscar-postre').value = ''
  pintarHojaPostres()
}
function pintarHojaPostres() {
  const lista = todos().filter((a) => a.postre)
  const cads = ['todos', ...Object.keys(CADENAS).filter((c) => lista.some((a) => cadenaDe(a) === c))]
  $('cadenas-postre').innerHTML = cads
    .map((c) => `<button class="chip" data-cp="${c}" aria-pressed="${c === cadenaPostre}">${c === 'todos' ? 'Todos' : CADENAS[c]}</button>`)
    .join('')
  const q = norm($('buscar-postre').value.trim())
  const filas = lista.filter((a) => (cadenaPostre === 'todos' || cadenaDe(a) === cadenaPostre) && (!q || norm(a.nombre).includes(q)))
  $('lista-postres').innerHTML = filas.length
    ? filas
        .map((a) => {
          const base = a.medida ? a.medida.g : 125
          const m = macrosDe(a, base)
          return `<button class="item" data-postre="${esc(a.id)}">
            <div class="info"><b>${esc(a.nombre)}</b><div class="meta">${cadenaDe(a) !== 'generico' ? `<span class="tag">${CADENAS[cadenaDe(a)]}</span>` : ''}<span>${a.medida ? `1 ${esc(a.medida.nombre)} (${fmt(base)} g)` : `${base} g`}</span></div></div>
            <div class="amount"><span>${fmt(m.p)} P · ${fmt(m.hc)} HC · ${fmt(m.g)} G</span><span>${Math.round(kcal(m))} kcal</span></div>
          </button>`
        })
        .join('')
    : '<div class="empty">No hay postres con ese filtro.</div>'
}
$('add-postre').addEventListener('click', abrirPostres)
$('sheet-close').addEventListener('click', () => ($('sheet').hidden = true))
$('sheet').addEventListener('click', (e) => {
  if (e.target === $('sheet')) $('sheet').hidden = true
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $('sheet').hidden = true
})
$('buscar-postre').addEventListener('input', pintarHojaPostres)
$('cadenas-postre').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cp]')
  if (!b) return
  cadenaPostre = b.dataset.cp
  pintarHojaPostres()
})
$('lista-postres').addEventListener('click', (e) => {
  const b = e.target.closest('[data-postre]')
  if (!b) return
  const a = porId(b.dataset.postre)
  const lista = estado.postres[estado.comida] || []
  lista.push(a.medida ? { id: a.id, modo: 'unidad', cantidad: 1 } : { id: a.id, modo: 'g', cantidad: 125 })
  estado.postres[estado.comida] = lista
  guardar()
  $('sheet').hidden = true
  pintar()
})

// ---------- Mi dieta ----------
let borrador = null
function pintarTabla() {
  const d = borrador || dieta()
  $('tabla-dieta').querySelector('tbody').innerHTML = COMIDAS.map(
    (c) => `<tr><td>${NOMBRE_COMIDA[c]}</td>${MACROS.map(
      (m) => `<td><input id="in-${c}-${m}" type="number" inputmode="decimal" min="0" step="0.5" value="${d[c] ? d[c][m] : 0}" aria-label="${NOMBRE_COMIDA[c]}, ${GRUPO[m]}" /></td>`,
    ).join('')}<td class="kc" id="kc-${c}">${Math.round(kcal(d[c] || { hc: 0, p: 0, g: 0 }))}</td></tr>`,
  ).join('')
}
function leerTabla() {
  const d = {}
  for (const c of COMIDAS) {
    d[c] = {}
    for (const m of MACROS) d[c][m] = Math.max(0, Number($(`in-${c}-${m}`).value) || 0)
  }
  return d
}
$('tabla-dieta').addEventListener('input', () => {
  const d = leerTabla()
  for (const c of COMIDAS) $(`kc-${c}`).textContent = Math.round(kcal(d[c]))
})
$('leer').addEventListener('click', () => {
  const { dieta: leida, avisos } = leerDieta($('texto').value)
  borrador = {}
  for (const c of COMIDAS) borrador[c] = leida[c] || { hc: 0, p: 0, g: 0 }
  $('avisos').hidden = !avisos.length
  $('avisos').innerHTML = avisos.map((a) => `<li>${esc(a)}</li>`).join('')
  $('guardado').hidden = true
  pintarTabla()
})
$('guardar').addEventListener('click', () => {
  estado.dieta = leerTabla()
  estado.texto = $('texto').value
  borrador = null
  guardar()
  $('guardado').hidden = false
  pintarComidas()
})

// ---------- Alimentos ----------
function fuente(a) {
  if (a.fdc) return `<a href="https://fdc.nal.usda.gov/food-details/${a.fdc}/nutrients" target="_blank" rel="noopener">USDA ${a.fdc}</a>`
  if (a.off) return `<a href="https://world.openfoodfacts.org/product/${a.off}" target="_blank" rel="noopener">OFF${a.fecha ? ' · ' + a.fecha : ''}</a>`
  return `<button class="del" data-borrar="${esc(a.id)}">Quitar</button>`
}
function pintarAlimentos() {
  const q = norm($('buscar-al').value.trim())
  const lista = todos().filter((a) => !q || norm(`${a.nombre} ${CADENAS[cadenaDe(a)]}`).includes(q))
  const orden = ['hc', 'p', 'g', 'postre']
  const nombreGrupo = { ...GRUPO, postre: 'Postres' }
  $('tabla-alimentos').querySelector('tbody').innerHTML =
    orden
      .map((gr) => {
        const filas = lista.filter((a) => a.grupo === gr)
        if (!filas.length) return ''
        return `<tr><th colspan="5">${nombreGrupo[gr]}</th></tr>` +
          filas
            .map((a) => {
              const det = [cadenaDe(a) !== 'generico' ? CADENAS[cadenaDe(a)] : '', a.estado || '', a.postre && gr !== 'postre' ? 'postre' : '', a.cocido ? `cocido: ${fmt(a.cocido.hc)} HC · ${fmt(a.cocido.p)} P · ${fmt(a.cocido.g)} G` : '', a.medida ? `1 ${a.medida.nombre} = ${fmt(a.medida.g)} g` : '', a.ml ? `1 ml = ${fmt(a.ml, 3)} g` : '']
                .filter(Boolean)
                .join(' · ')
              return `<tr><td>${esc(a.nombre)}${det ? `<br><small>${esc(det)}</small>` : ''}</td><td>${fmt(a.hc)}</td><td>${fmt(a.p)}</td><td>${fmt(a.g)}</td><td>${fuente(a)}</td></tr>`
            })
            .join('')
      })
      .join('') || '<tr><td colspan="5">Sin resultados.</td></tr>'
}
$('buscar-al').addEventListener('input', pintarAlimentos)
$('tabla-alimentos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-borrar]')
  if (!b) return
  estado.propios = estado.propios.filter((a) => a.id !== b.dataset.borrar)
  guardar()
  pintarAlimentos()
})
$('form-alimento').addEventListener('submit', (e) => {
  e.preventDefault()
  const unidad = Number($('f-unidad').value) || 0
  const a = {
    id: `propio-${Date.now()}`,
    nombre: $('f-nombre').value.trim(),
    grupo: $('f-grupo').value,
    propio: true,
    hc: Number($('f-hc').value) || 0,
    p: Number($('f-p').value) || 0,
    g: Number($('f-g').value) || 0,
  }
  if (unidad > 0) a.medida = { nombre: 'unidad', g: unidad }
  if ($('f-postre').checked) a.postre = true
  if (!a.nombre || a.hc + a.p + a.g === 0) return
  estado.propios.push(a)
  guardar()
  e.target.reset()
  $('anadido').hidden = false
  pintarAlimentos()
})

// ---------- Navegación ----------
const VISTAS = ['equiv', 'dieta', 'alimentos']
function pintar() {
  pintarComidas()
  if (estado.vista === 'equiv') pintarEquiv()
}
function mostrar(vista) {
  estado.vista = vista
  guardar()
  for (const v of VISTAS) {
    $(`vista-${v}`).hidden = v !== vista
    $(`nav-${v}`).setAttribute('aria-pressed', String(v === vista))
  }
  $('meals').hidden = vista === 'dieta' || vista === 'alimentos'
  $('mini').hidden = vista !== 'equiv'
  if (vista === 'dieta') {
    $('texto').value = estado.texto || ''
    borrador = null
    $('avisos').hidden = true
    $('guardado').hidden = true
    pintarTabla()
  }
  if (vista === 'alimentos') {
    $('anadido').hidden = true
    pintarAlimentos()
  }
  pintar()
  window.scrollTo(0, 0)
}
document.querySelector('nav.bottom').addEventListener('click', (e) => {
  const b = e.target.closest('[data-vista]')
  if (b) mostrar(b.dataset.vista)
})

mostrar(VISTAS.includes(estado.vista) ? estado.vista : 'equiv')

if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.endsWith('claude.ai')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}
