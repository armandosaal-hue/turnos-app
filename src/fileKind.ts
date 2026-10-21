// Tipo de archivo por su contenido. Las fotos que llegan desde WhatsApp o la
// galería en Android pueden venir sin extensión y sin tipo declarado.
export type FileKind = 'image' | 'heic' | 'xlsx' | 'csv' | 'unknown'

export async function fileKind(file: Blob & { name?: string }): Promise<FileKind> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to))
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image' // JPEG
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image'
  if (ascii(0, 3) === 'GIF') return 'image'
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12)
    if (/^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(brand)) return 'heic'
    if (/^avi[fs]$/.test(brand)) return 'image'
  }
  if (b[0] === 0x50 && b[1] === 0x4b) return 'xlsx' // ZIP (formato de Excel moderno)
  const name = file.name ?? ''
  if (/\.csv$/i.test(name) || (file.type ?? '').includes('csv')) return 'csv'
  if ((file.type ?? '').startsWith('image/')) return 'image'
  return 'unknown'
}
