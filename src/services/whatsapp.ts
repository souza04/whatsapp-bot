import axios from 'axios'

// ============================================================
// Serviço WhatsApp — Evolution API
// Responsável por ENVIAR mensagens de volta ao cliente
// ============================================================

const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
const API_KEY  = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? ''

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    apikey: API_KEY,
  },
})

// Envia texto simples
export async function sendText(to: string, text: string): Promise<void> {
  await api.post(`/message/sendText/${INSTANCE}`, {
    number: to,
    text,
  })
}

// Envia indicador de "digitando..." antes de responder
// Deixa a experiência mais natural e humana
export async function sendTyping(to: string, durationMs = 2000): Promise<void> {
  await api.post(`/chat/sendPresence/${INSTANCE}`, {
    number: to,
    options: { delay: durationMs, presence: 'composing' },
  })
}

// Baixa mídia recebida (áudio, documento, imagem)
// A Evolution API precisa buscar o arquivo antes de você poder processar
export async function downloadMedia(messageId: string): Promise<string> {
  const response = await api.post(`/chat/getBase64FromMediaMessage/${INSTANCE}`, {
    message: { key: { id: messageId } },
    convertToMp4: false,
  })
  // Retorna URL temporária ou base64 conforme configuração da sua instância
  return response.data.base64 ?? response.data.url
}
