// Reduce la foto (lado largo ≤ 2000 px), aplica el giro y la pasa a JPEG en base64.
export async function prepareImage(file: File, rotation: number): Promise<string> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('El navegador no puede abrir esta foto. Guárdala como JPG y vuelve a intentarlo.')
  }
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const swap = rotation % 180 !== 0
  const canvas = document.createElement('canvas')
  canvas.width = swap ? h : w
  canvas.height = swap ? w : h
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]
}
