import { leerDieta, calcularGramos, proponer, equivalencia, equivalencias, textoMedida, gramosPostre, restarPostres, ajustarPlato, resumenPlato, textoVolumen } from '../../public/dieta/logic.js'
import { ALIMENTOS } from '../../public/dieta/alimentos.js'

const al = (id) => ALIMENTOS.find((a) => a.id === id)

describe('leerDieta', () => {
  it('lee etiqueta antes del número', () => {
    const { dieta, avisos } = leerDieta(`Desayuno: HC 60 g, Proteína 30 g, Grasa 15 g
Comida - Hidratos 80 / Prot 45 / Grasas 20
Merienda: HC 30 P 25 G 10
Cena: carbohidratos: 50, proteínas: 40, lípidos: 15`)
    expect(dieta).toEqual({
      desayuno: { hc: 60, p: 30, g: 15 },
      comida: { hc: 80, p: 45, g: 20 },
      merienda: { hc: 30, p: 25, g: 10 },
      cena: { hc: 50, p: 40, g: 15 },
    })
    expect(avisos).toEqual([])
  })

  it('lee número antes de la etiqueta, decimales con coma y comidas en varias líneas', () => {
    const { dieta } = leerDieta(`DESAYUNO
60g de hidratos
32,5 g de proteína
15 g de grasa

ALMUERZO (14:00)
90 HC 40 P 18 G`)
    expect(dieta.desayuno).toEqual({ hc: 60, p: 32.5, g: 15 })
    expect(dieta.comida).toEqual({ hc: 90, p: 40, g: 18 })
  })

  it('acepta tres números sin etiqueta y avisa', () => {
    const { dieta, avisos } = leerDieta('Cena: 50 / 40 / 15')
    expect(dieta.cena).toEqual({ hc: 50, p: 40, g: 15 })
    expect(avisos.some((a) => a.includes('sin etiqueta'))).toBe(true)
    expect(avisos.some((a) => a.includes('desayuno'))).toBe(true)
  })
})

describe('calcularGramos', () => {
  it('cuadra exactamente arroz, pollo y aceite', () => {
    const objetivo = { hc: 80, p: 45, g: 20 }
    const trio = [al('arroz'), al('pollo'), al('aceite')]
    const x = calcularGramos(objetivo, trio)
    const total = (k) => trio.reduce((s, a, i) => s + (a[k] * x[i]) / 100, 0)
    expect(total('hc')).toBeCloseTo(80, 6)
    expect(total('p')).toBeCloseTo(45, 6)
    expect(total('g')).toBeCloseTo(20, 6)
    expect(x.every((v) => v >= 0)).toBe(true)
  })

  it('no propone gramos negativos cuando la proteína ya trae más grasa de la pedida', () => {
    const x = calcularGramos({ hc: 40, p: 40, g: 5 }, [al('patata'), al('salmon'), al('aceite')])
    expect(x.every((v) => v >= 0)).toBe(true)
    expect(x[2]).toBe(0)
  })
})

describe('proponer', () => {
  it('redondea a gramos prácticos y da la diferencia con el objetivo', () => {
    const r = proponer({ hc: 80, p: 45, g: 20 }, [al('arroz'), al('pollo'), al('aceite')])
    expect(r.gramos[0] % 5).toBe(0)
    expect(Math.abs(r.diferencia.hc)).toBeLessThan(5)
    expect(Math.abs(r.diferencia.p)).toBeLessThan(5)
    expect(Math.abs(r.diferencia.g)).toBeLessThan(2)
  })
})

describe('equivalencias', () => {
  it('calcula gramos en seco y cocido para el macro principal', () => {
    const eq = equivalencia(al('arroz'), 'hc', 60)
    // 60 g de HC / 80 g por 100 g de arroz seco = 75 g; cocido: 60 / 28,2 = 212,8 → 215
    expect(eq.gramos).toBe(75)
    expect(eq.cocido).toBe(215)
    expect(eq.extra.p).toBeCloseTo(5.35, 1)
  })

  it('incluye los alimentos de doble grupo en su grupo secundario', () => {
    const lista = equivalencias(ALIMENTOS, 'p', 30)
    const lentejas = lista.find((x) => x.alimento.id === 'lentejas')
    expect(lentejas.secundario).toBe(true)
    expect(lista.some((x) => x.alimento.id === 'arroz')).toBe(false)
  })

  it('da la medida casera', () => {
    const eq = equivalencia(al('pan-integral'), 'hc', 30)
    expect(textoMedida(al('pan-integral').medida, eq.medidas)).toBe('≈ 2 rebanadas')
    expect(textoMedida({ nombre: 'huevo L', g: 50 }, 3)).toBe('≈ 3 huevos L')
  })
})

describe('postres', () => {
  it('resta el postre del objetivo y avisa del exceso', () => {
    const yogur = ALIMENTOS.find((a) => a.off === '8480000209085')
    const g = gramosPostre(yogur, { modo: 'unidad', cantidad: 1 })
    expect(g).toBe(120)
    const r = restarPostres({ hc: 50, p: 10, g: 15 }, [{ alimento: yogur, gramos: g }])
    expect(r.resta.p).toBe(0)
    expect(r.exceso.p).toBeCloseTo(2, 0)
    expect(r.resta.hc).toBeCloseTo(50 - 3.72, 1)
  })
})

describe('datos de alimentos', () => {
  it('cada alimento tiene macros válidos, fuente e identificador único', () => {
    const ids = new Set()
    for (const a of ALIMENTOS) {
      expect(ids.has(a.id)).toBe(false)
      ids.add(a.id)
      for (const k of ['hc', 'p', 'g']) expect(a[k]).toBeGreaterThanOrEqual(0)
      expect(a.hc + a.p + a.g).toBeLessThanOrEqual(100.5)
      expect(Boolean(a.fdc) !== Boolean(a.off)).toBe(true)
    }
  })
})

describe('plato', () => {
  const obj = { hc: 80, p: 45, g: 20 }

  it('con solo pollo cubre la proteína', () => {
    const [x] = ajustarPlato(obj, [], [{ alimento: al('pollo'), grupo: 'p' }])
    expect(x).toBeCloseTo((45 * 100) / 22.5, 5)
  })

  it('al añadir arroz descuenta su proteína del pollo', () => {
    const solo = ajustarPlato(obj, [], [{ alimento: al('pollo'), grupo: 'p' }])[0]
    const [pollo, arroz] = ajustarPlato(obj, [], [
      { alimento: al('pollo'), grupo: 'p' },
      { alimento: al('arroz'), grupo: 'hc' },
    ])
    expect(arroz).toBeCloseTo(100, 5) // 80 g HC / 0,80
    expect(pollo).toBeCloseTo(solo - (arroz * 7.13) / 22.5, 5)
  })

  it('cuadra los tres macros con postre fijo', () => {
    const flan = ALIMENTOS.find((a) => a.off === '8480000676351')
    const fijos = [{ alimento: flan, gramos: 100 }]
    const autos = [
      { alimento: al('pollo'), grupo: 'p' },
      { alimento: al('arroz'), grupo: 'hc' },
      { alimento: al('aceite'), grupo: 'g' },
    ]
    const x = ajustarPlato(obj, fijos, autos)
    const total = (k) => (flan[k] * 100) / 100 + autos.reduce((s, a, i) => s + (a.alimento[k] * x[i]) / 100, 0)
    for (const k of ['hc', 'p', 'g']) expect(total(k)).toBeCloseTo(obj[k], 5)
  })

  it('reparte un grupo entre dos alimentos y no da gramos negativos', () => {
    const autos = [
      { alimento: al('pollo'), grupo: 'p' },
      { alimento: al('pavo'), grupo: 'p' },
      { alimento: al('salmon'), grupo: 'p' },
      { alimento: al('aceite'), grupo: 'g' },
    ]
    const x = ajustarPlato({ hc: 0, p: 45, g: 5 }, [], autos)
    expect(x.every((v) => v >= 0)).toBe(true)
    expect(x[3]).toBe(0) // el salmón ya trae más grasa de la pedida
    const r = resumenPlato({ hc: 0, p: 45, g: 5 }, [], autos)
    expect(r.exceso.g).toBeGreaterThan(0)
  })
})

describe('líquidos', () => {
  it('da la equivalencia en mililitros y vasos', () => {
    const leche = al('leche-desnatada')
    expect(leche.ml).toBeCloseTo(1.035, 3)
    // 300 g / 1,035 g/ml = 289,9 ml → 290 ml; 290 / 250 = 1,2 vasos
    expect(textoVolumen(leche, 300)).toBe('≈ 290 ml (1,2 vasos de 250 ml)')
    expect(textoVolumen(al('aceite'), 11)).toBe('≈ 12 ml')
    expect(textoVolumen(al('pollo'), 100)).toBe('')
  })
})
