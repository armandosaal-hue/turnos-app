import { fileKind } from './fileKind'

const file = (bytes: number[], name = 'sin-extension', type = '') => new File([new Uint8Array(bytes)], name, { type })
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))

describe('tipo de archivo por contenido', () => {
  it('reconoce un JPEG sin extensión ni tipo (WhatsApp en Android)', async () => {
    expect(await fileKind(file([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe('image')
  })
  it('reconoce PNG y WebP', async () => {
    expect(await fileKind(file([0x89, ...ascii('PNG'), 13, 10]))).toBe('image')
    expect(await fileKind(file([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')]))).toBe('image')
  })
  it('distingue HEIC de iPhone', async () => {
    expect(await fileKind(file([0, 0, 0, 24, ...ascii('ftypheic')]))).toBe('heic')
  })
  it('reconoce Excel y CSV', async () => {
    expect(await fileKind(file([0x50, 0x4b, 3, 4], 'plantilla'))).toBe('xlsx')
    expect(await fileKind(file(ascii('a;b\n1;2'), 'turnos.csv'))).toBe('csv')
  })
  it('rechaza lo demás', async () => {
    expect(await fileKind(file(ascii('%PDF-1.7'), 'doc.pdf'))).toBe('unknown')
  })
})
