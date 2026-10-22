import { ALIMENTOS, POR_DEFECTO } from './alimentos.js'
import { COMIDAS, NOMBRE_COMIDA, MACROS, leerDieta, kcal, proponer, nombreMacro } from './logic.js'

const CLAVE = 'mi-dieta-v1'
const EJEMPLO = {
  desayuno: { hc: 60, p: 30, g: 15 },
  comida: { hc: 80, p: 45, g: 20 },
  merienda: { hc: 30, p: 25, g: 10 },
  cena: { hc: 50, p: 40, g: 15 },
}
const GRUPO = { hc: 'Hidratos', p: 'Proteína', g: 'Grasa' }

function cargar() {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) || 'null')
    if (s && typeof s === 'object') return s
  } catch {}
  return {}
}

const estado = Object.assign({ dieta: null, eleccion: {}, propios: [], comida: 'comida', texto: '' }, cargar())

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado))
  } catch {}
}

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('es-ES')
const todos = () => [...ALIMENTOS, ...estado.propios]
const porId = (id) => todos().find((a) => a.id === id)
const dieta = () => estado.dieta || EJEMPLO

function eleccionDe(comida) {
  const e = { ...POR_DEFECTO[comida], ...(estado.eleccion[comida] || {}) }
  for (const m of MACROS) if (!porId(e[m])) e[m] = POR_DEFECTO[comida][m]
  return e
}

// ---------- Comidas ----------
function pintarPlan() {
  const d = dieta()
  $('banner-ejemplo').hidden = !!estado.dieta
  $('meals').innerHTML = COMIDAS.map(
    (c) => `<button class="meal" id="meal-${c}" data-comida="${c}" aria-pressed="${c === estado.comida}">
      ${NOMBRE_COMIDA[c]}<small>${Math.round(kcal(d[c]))} kcal</small></button>`,
  ).join('')

  const obj = d[estado.comida]
  $('target').innerHTML =
    MACROS.map((m) => `<div><span class="label">${GRUPO[m]}</span><span class="num c-${m}">${fmt(obj[m])} g</span></div>`).join('') +
    `<div><span class="label">Energía</span><span class="num">${Math.round(kcal(obj))}</span></div>`

  const el = eleccionDe(estado.comida)
  const trio = MACROS.map((m) => porId(el[m]))
  const r = proponer(obj, trio)
  $('plato-titulo').textContent = `Tu ${NOMBRE_COMIDA[estado.comida].toLowerCase()}`
  $('plate').innerHTML = trio
    .map(
      (a, i) => `<div class="row"><span class="bar ${MACROS[i]}"></span>
      <div class="name"><b>${esc(a.nombre)}</b><span>${esc(a.estado || GRUPO[MACROS[i]].toLowerCase())}</span></div>
      <div class="grams">${r.gramos[i]}<small>g</small></div></div>`,
    )
    .join('')

  const lejos = MACROS.filter((m) => Math.abs(r.diferencia[m]) > 3)
  $('check').innerHTML =
    MACROS.map((m) => {
      const dif = r.diferencia[m]
      const txt = Math.abs(dif) < 0.5 ? 'exacto' : `${dif > 0 ? '+' : ''}${fmt(dif)} g`
      return `<div><span class="label">${GRUPO[m]}</span><b>${fmt(r.total[m])} g</b><span class="${lejos.includes(m) ? 'off' : ''}">${txt}</span></div>`
    }).join('') + `<div><span class="label">Energía</span><b>${Math.round(kcal(r.total))} kcal</b><span>de ${Math.round(kcal(obj))}</span></div>`
  const aviso = $('aviso-plato')
  aviso.hidden = lejos.length === 0
  aviso.className = 'help off'
  aviso.textContent = lejos.length
    ? `Con esta combinación no cuadra la ${lejos.map(nombreMacro).join(' ni la ')}. Prueba otro alimento de la lista.`
    : ''

  $('options').innerHTML = MACROS.map((m, i) => {
    const chips = todos()
      .filter((a) => a.grupo === m)
      .map((a) => {
        const prueba = trio.map((t, j) => (j === i ? a : t))
        const g = proponer(obj, prueba).gramos[i]
        return `<button class="chip ${m}" data-macro="${m}" data-id="${esc(a.id)}" aria-pressed="${a.id === el[m]}">
          <span>${esc(a.nombre)}</span><span>${g} g</span></button>`
      })
      .join('')
    return `<h3 class="c-${m}">Opciones de ${GRUPO[m].toLowerCase()}</h3><div class="chips">${chips}</div>`
  }).join('')
}

$('meals').addEventListener('click', (e) => {
  const b = e.target.closest('[data-comida]')
  if (!b) return
  estado.comida = b.dataset.comida
  guardar()
  pintarPlan()
})

$('options').addEventListener('click', (e) => {
  const b = e.target.closest('[data-macro]')
  if (!b) return
  estado.eleccion[estado.comida] = { ...eleccionDe(estado.comida), [b.dataset.macro]: b.dataset.id }
  guardar()
  pintarPlan()
})

// ---------- Cargar dieta ----------
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
  const ul = $('avisos')
  ul.hidden = avisos.length === 0
  ul.innerHTML = avisos.map((a) => `<li>${esc(a)}</li>`).join('')
  pintarTabla()
  $('guardado').hidden = true
})

$('guardar').addEventListener('click', () => {
  estado.dieta = leerTabla()
  estado.texto = $('texto').value
  borrador = null
  guardar()
  $('guardado').hidden = false
  pintarPlan()
})

// ---------- Alimentos ----------
function pintarAlimentos() {
  $('tabla-alimentos').querySelector('tbody').innerHTML = MACROS.map((m) =>
    todos()
      .filter((a) => a.grupo === m)
      .map((a) => {
        const origen = a.fdc
          ? `<a href="https://fdc.nal.usda.gov/food-details/${a.fdc}/nutrients" target="_blank" rel="noopener">FDC ${a.fdc}</a>`
          : `<button class="del" data-borrar="${esc(a.id)}">Quitar</button>`
        return `<tr><td><span class="c-${m}">●</span> ${esc(a.nombre)}${a.estado ? ` <span class="help">(${esc(a.estado)})</span>` : ''}</td>
          <td>${fmt(a.hc)}</td><td>${fmt(a.p)}</td><td>${fmt(a.g)}</td><td>${origen}</td></tr>`
      })
      .join(''),
  ).join('')
}

$('tabla-alimentos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-borrar]')
  if (!b) return
  estado.propios = estado.propios.filter((a) => a.id !== b.dataset.borrar)
  guardar()
  pintarAlimentos()
})

$('form-alimento').addEventListener('submit', (e) => {
  e.preventDefault()
  const a = {
    id: `propio-${Date.now()}`,
    nombre: $('f-nombre').value.trim(),
    estado: 'mi alimento',
    grupo: $('f-grupo').value,
    hc: Number($('f-hc').value) || 0,
    p: Number($('f-p').value) || 0,
    g: Number($('f-g').value) || 0,
  }
  if (!a.nombre || a.hc + a.p + a.g === 0) return
  estado.propios.push(a)
  guardar()
  e.target.reset()
  $('anadido').hidden = false
  pintarAlimentos()
})

// ---------- Navegación ----------
function mostrar(vista) {
  for (const v of ['plan', 'cargar', 'alimentos']) {
    $(`vista-${v}`).hidden = v !== vista
    $(`nav-${v}`).setAttribute('aria-pressed', String(v === vista))
  }
  if (vista === 'plan') pintarPlan()
  if (vista === 'cargar') {
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
}
document.querySelector('.nav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-vista]')
  if (b) mostrar(b.dataset.vista)
})

mostrar('plan')

if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.endsWith('claude.ai')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}
