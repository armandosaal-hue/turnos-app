import { ALIMENTOS } from './alimentos.js'
import {
  COMIDAS, NOMBRE_COMIDA, MACROS, leerDieta, kcal, proponer, nombreMacro,
  equivalencias, textoMedida, gramosPostre, restarPostres, macrosDe,
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
const POR_DEFECTO_AJUSTE = {
  desayuno: { hc: 'avena', p: 'claras', g: 'crema-cacahuete' },
  comida: { hc: 'arroz', p: 'pollo', g: 'aceite' },
  merienda: { hc: 'tortitas-arroz', p: 'yogur-griego-0', g: 'nueces' },
  cena: { hc: 'patata', p: 'bacalao', g: 'aceite' },
}

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
  { dieta: null, texto: '', comida: 'comida', grupo: 'hc', cadena: 'todos', favoritos: [], postres: {}, propios: [], ajuste: {}, vista: 'equiv' },
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

// Objetivo de la comida y lo que queda tras el postre.
function situacion() {
  const objetivo = dieta()[estado.comida]
  const ps = postresDe(estado.comida).map(({ it, alimento }) => ({ alimento, gramos: gramosPostre(alimento, it) }))
  return { objetivo, ...restarPostres(objetivo, ps), hayPostre: ps.length > 0 }
}

function tiles(m, extra = {}) {
  return (
    MACROS.map(
      (k) => `<div class="macro ${k}"><span class="label">${GRUPO[k]}</span><b>${fmt(m[k])} g</b>${extra[k] || ''}</div>`,
    ).join('') + `<div class="macro"><span class="label">Energía</span><b>${Math.round(kcal(m))}</b><span>kcal</span></div>`
  )
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

// ---------- Equivalencias ----------
function pintarEquiv() {
  const s = situacion()
  $('obj-titulo').textContent = `Objetivo de la ${NOMBRE_COMIDA[estado.comida].toLowerCase()}`
  $('objetivo').innerHTML = tiles(s.objetivo)

  const conPostre = CON_POSTRE.includes(estado.comida)
  $('panel-postre').hidden = !conPostre
  if (conPostre) pintarPostres(s)

  const resta = s.resta
  $('tabs').innerHTML = MACROS.map(
    (k) => `<button class="tab ${k}" role="tab" data-grupo="${k}" aria-selected="${k === estado.grupo}">${GRUPO[k]}<small>${fmt(resta[k])} g</small></button>`,
  ).join('')

  const opciones = ['todos', 'favoritos', ...Object.keys(CADENAS).filter((c) => c !== 'propio' || estado.propios.length)]
  $('cadenas').innerHTML = opciones
    .map((c) => `<button class="chip" data-cadena="${c}" aria-pressed="${c === estado.cadena}">${c === 'todos' ? 'Todos' : c === 'favoritos' ? '★ Favoritos' : CADENAS[c]}</button>`)
    .join('')
  pintarLista()
}

function pintarLista() {
  const { resta } = situacion()
  const k = estado.grupo
  const objetivo = resta[k]
  if (!(objetivo > 0.5)) {
    $('lista').innerHTML = `<div class="covered">Ya tienes cubiertos los ${GRUPO[k].toLowerCase()} de esta comida.</div>`
    $('nota-lista').textContent = ''
    return
  }
  const q = norm($('buscar').value.trim())
  let filas = equivalencias(todos(), k, objetivo).filter(({ alimento: a }) => {
    if (estado.cadena === 'favoritos' && !esFav(a.id)) return false
    if (!['todos', 'favoritos'].includes(estado.cadena) && cadenaDe(a) !== estado.cadena) return false
    return !q || norm(`${a.nombre} ${CADENAS[cadenaDe(a)]}`).includes(q)
  })
  // Favoritos arriba; los alimentos que cuentan sobre todo en otro grupo, al final.
  const rango = (f) => (esFav(f.alimento.id) ? 0 : f.secundario ? 2 : 1)
  filas = [0, 1, 2].flatMap((r) => filas.filter((f) => rango(f) === r))
  if (!filas.length) {
    $('lista').innerHTML = `<div class="empty">${estado.cadena === 'favoritos' ? 'Aún no tienes favoritos. Toca la estrella de un alimento para tenerlo arriba.' : 'No hay alimentos con ese filtro.'}</div>`
  } else {
    $('lista').innerHTML = filas.map(({ alimento: a, secundario, eq }) => filaEquiv(a, k, secundario, eq)).join('')
  }
  $('nota-lista').textContent = `${filas.length} opciones para ${fmt(objetivo)} g de ${GRUPO[k].toLowerCase()}. Cada una cubre ese macro sola; debajo ves lo que aporta de los otros.`
}

function filaEquiv(a, k, secundario, eq) {
  const cad = cadenaDe(a)
  const otros = Object.entries(eq.extra)
    .filter(([, v]) => v >= 0.5)
    .map(([m, v]) => `${fmt(v, 0)} g ${m === 'hc' ? 'HC' : m === 'p' ? 'prot.' : 'grasa'}`)
    .join(' · ')
  const meta = [
    a.estado && !a.cocido ? esc(a.estado) : '',
    cad !== 'generico' ? `<span class="tag">${CADENAS[cad]}</span>` : '',
    secundario ? `<span class="tag also">cuenta como ${GRUPO[a.grupo].toLowerCase()}</span>` : '',
    otros ? `<span>también ${otros}</span>` : '',
  ].filter(Boolean).join('')
  const etiqueta = a.cocido ? (a.estado || 'seco') : 'g'
  const lineas = [
    a.cocido && eq.cocido ? `<span class="cooked">cocido ≈ ${eq.cocido} g</span>` : '',
    a.medida ? `<span>${esc(textoMedida(a.medida, eq.medidas))}</span>` : '',
  ].join('')
  return `<div class="item">
    <button class="star" data-fav="${esc(a.id)}" aria-pressed="${esFav(a.id)}" aria-label="Favorito">★</button>
    <div class="info"><b>${esc(a.nombre)}</b><div class="meta">${meta}</div></div>
    <div class="amount"><b>${eq.gramos}<small>${a.cocido ? esc(etiqueta) : 'g'}</small></b>${lineas}</div>
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
      const cant = it.modo === 'unidad' ? `${fmt(it.cantidad)} × ${a.medida.nombre}` : `${it.cantidad} g`
      return `<div class="dessert">
        <div class="name"><b>${esc(a.nombre)}</b><span>${cadenaDe(a) !== 'generico' ? CADENAS[cadenaDe(a)] + ' · ' : ''}${fmt(m.p)} P · ${fmt(m.hc)} HC · ${fmt(m.g)} G</span></div>
        <div class="qty"><button data-menos="${i}" aria-label="Menos">−</button><output>${cant}</output><button data-mas="${i}" aria-label="Más">+</button></div>
        <button class="rm" data-quitar="${i}">Quitar</button>
      </div>`
    })
    .join('')
  $('postre-total').textContent = items.length ? `${Math.round(kcal(s.postre))} kcal` : 'Opcional'
  $('resta-wrap').hidden = !items.length
  if (items.length) {
    $('resta').innerHTML = tiles(s.resta)
    const ex = Object.entries(s.exceso)
    $('exceso').hidden = !ex.length
    $('exceso').textContent = ex.length
      ? `El postre supera tu objetivo de ${ex.map(([k, v]) => `${nombreMacro(k)} en ${fmt(v)} g`).join(' y ')}.`
      : ''
  }
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

// ---------- Ajuste fino ----------
function opcionesSelect(k, elegido) {
  const lista = todos().filter((a) => a.grupo === k)
  return Object.keys(CADENAS)
    .map((c) => {
      const grupo = lista.filter((a) => cadenaDe(a) === c)
      if (!grupo.length) return ''
      return `<optgroup label="${CADENAS[c]}">${grupo
        .map((a) => `<option value="${esc(a.id)}"${a.id === elegido ? ' selected' : ''}>${esc(a.nombre)}${a.estado ? ` (${esc(a.estado)})` : ''}</option>`)
        .join('')}</optgroup>`
    })
    .join('')
}

function eleccionAjuste() {
  const e = { ...POR_DEFECTO_AJUSTE[estado.comida], ...(estado.ajuste[estado.comida] || {}) }
  for (const k of MACROS) if (!porId(e[k])) e[k] = POR_DEFECTO_AJUSTE[estado.comida][k]
  return e
}

function pintarAjuste() {
  const el = eleccionAjuste()
  for (const k of MACROS) $(`sel-${k}`).innerHTML = opcionesSelect(k, el[k])
  const s = situacion()
  const trio = MACROS.map((k) => porId(el[k]))
  const r = proponer(s.resta, trio)
  const postres = postresDe(estado.comida)
  $('plate').innerHTML =
    trio
      .map(
        (a, i) => `<div class="row"><span class="bar ${MACROS[i]}"></span>
        <div class="name"><b>${esc(a.nombre)}</b><span>${esc(a.estado || CADENAS[cadenaDe(a)])}${a.medida && r.gramos[i] ? ' · ' + esc(textoMedida(a.medida, r.gramos[i] / a.medida.g)) : ''}</span></div>
        <div class="grams">${r.gramos[i]}<small>g</small></div></div>`,
      )
      .join('') +
    postres
      .map(({ it, alimento: a }) => `<div class="row"><span class="bar postre"></span><div class="name"><b>${esc(a.nombre)}</b><span>postre</span></div><div class="grams">${fmt(gramosPostre(a, it), 0)}<small>g</small></div></div>`)
      .join('')
  const total = { hc: r.total.hc + s.postre.hc, p: r.total.p + s.postre.p, g: r.total.g + s.postre.g }
  const lejos = MACROS.filter((k) => Math.abs(total[k] - s.objetivo[k]) > 3)
  const extra = Object.fromEntries(
    MACROS.map((k) => {
      const d = total[k] - s.objetivo[k]
      return [k, `<span class="${lejos.includes(k) ? 'off' : ''}">${Math.abs(d) < 0.5 ? 'exacto' : (d > 0 ? '+' : '') + fmt(d) + ' g'}</span>`]
    }),
  )
  $('check').innerHTML = tiles(total, extra)
  $('aviso-plato').hidden = !lejos.length
  $('aviso-plato').textContent = lejos.length ? `Con esta combinación no cuadra la ${lejos.map(nombreMacro).join(' ni la ')}. Prueba otro alimento.` : ''
}
for (const k of MACROS) {
  $(`sel-${k}`).addEventListener('change', (e) => {
    estado.ajuste[estado.comida] = { ...eleccionAjuste(), [k]: e.target.value }
    guardar()
    pintarAjuste()
  })
}

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
              const det = [cadenaDe(a) !== 'generico' ? CADENAS[cadenaDe(a)] : '', a.estado || '', a.postre && gr !== 'postre' ? 'postre' : '', a.cocido ? `cocido: ${fmt(a.cocido.hc)} HC · ${fmt(a.cocido.p)} P · ${fmt(a.cocido.g)} G` : '', a.medida ? `1 ${a.medida.nombre} = ${fmt(a.medida.g)} g` : '']
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
const VISTAS = ['equiv', 'ajuste', 'dieta', 'alimentos']
function pintar() {
  pintarComidas()
  if (estado.vista === 'equiv') pintarEquiv()
  if (estado.vista === 'ajuste') pintarAjuste()
}
function mostrar(vista) {
  estado.vista = vista
  guardar()
  for (const v of VISTAS) {
    $(`vista-${v}`).hidden = v !== vista
    $(`nav-${v}`).setAttribute('aria-pressed', String(v === vista))
  }
  $('meals').hidden = vista === 'dieta' || vista === 'alimentos'
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
