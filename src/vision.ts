import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ReadingSchema, VISION_PROMPT, type Reading } from './domain/vision'
import { MODELS, type VisionSettings } from './visionSettings'

export interface ReadResult {
  reading: Reading
  costUsd: number
}

export async function readImage(settings: VisionSettings, base64: string): Promise<ReadResult> {
  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 })
  const stream = client.beta.messages.stream({
    model: settings.model,
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: zodOutputFormat(ReadingSchema) },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: VISION_PROMPT },
        ],
      },
    ],
  })
  const msg = await stream.finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error('Claude no ha querido procesar esta imagen.')
  if (msg.stop_reason === 'max_tokens') throw new Error('La respuesta se ha cortado: la imagen tiene demasiadas filas. Prueba a dividirla.')
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  let reading: Reading
  try {
    reading = ReadingSchema.parse(JSON.parse(text))
  } catch {
    throw new Error('La respuesta no tiene el formato esperado. Vuelve a intentarlo.')
  }
  const price = MODELS.find((m) => m.id === msg.model) ?? MODELS[0]
  const costUsd = (msg.usage.input_tokens * price.input + msg.usage.output_tokens * price.output) / 1_000_000
  return { reading, costUsd }
}

export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'La clave de API no es válida. Revísala en Ajustes → Imágenes.'
  if (e instanceof Anthropic.PermissionDeniedError) return 'La clave no tiene permiso para usar este modelo.'
  if (e instanceof Anthropic.RateLimitError) return 'Demasiadas peticiones seguidas. Espera un minuto y vuelve a intentarlo.'
  if (e instanceof Anthropic.BadRequestError) {
    if (/credit|balance/i.test(e.message)) return 'Tu cuenta de Anthropic no tiene saldo. Recárgalo en console.anthropic.com.'
    return `Petición rechazada: ${e.message}`
  }
  if (e instanceof Anthropic.APIConnectionError) return 'Sin conexión con la API de Anthropic. Comprueba internet.'
  if (e instanceof Anthropic.APIError) return `Error de la API (${e.status}): ${e.message}`
  return e instanceof Error ? e.message : String(e)
}
