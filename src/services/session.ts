import { createClient } from 'redis'
import type { ConversationSession } from '../types'

// ============================================================
// Serviço de sessões via Redis
// Cada conversa fica viva por SESSION_TTL_SECONDS.
// Depois disso, o bot "esquece" e começa do zero.
// ============================================================

const SESSION_TTL_SECONDS = 30 * 60  // 30 minutos de inatividade = nova sessão
const SESSION_MAX_MESSAGES = 20       // limite de mensagens por sessão (controle de tokens)

const client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' })

client.on('error', (err) => console.error('[Redis] erro:', err))

export async function connectRedis() {
  await client.connect()
  console.log('[Redis] conectado ✅')
}

function sessionKey(phone: string) {
  return `session:${phone}`
}

// Busca ou cria uma sessão para o número
export async function getOrCreateSession(phone: string, name: string): Promise<ConversationSession> {
  const raw = await client.get(sessionKey(phone))

  if (raw) {
    const session: ConversationSession = JSON.parse(raw)
    session.lastActivity = Date.now()
    await saveSession(session)
    return session
  }

  // Nova sessão
  const session: ConversationSession = {
    phone,
    name,
    messages: [],
    lastActivity: Date.now(),
  }
  await saveSession(session)
  return session
}

// Adiciona uma mensagem à sessão e salva
export async function addMessageToSession(
  phone: string,
  role: 'user' | 'assistant',
  content: string
) {
  const raw = await client.get(sessionKey(phone))
  if (!raw) return

  const session: ConversationSession = JSON.parse(raw)
  session.messages.push({ role, content })
  session.lastActivity = Date.now()

  // Mantém apenas as últimas N mensagens para não explodir o contexto
  if (session.messages.length > SESSION_MAX_MESSAGES) {
    session.messages = session.messages.slice(-SESSION_MAX_MESSAGES)
  }

  await saveSession(session)
}

async function saveSession(session: ConversationSession) {
  await client.setEx(
    sessionKey(session.phone),
    SESSION_TTL_SECONDS,
    JSON.stringify(session)
  )
}

// Limpa a sessão (útil após concluir um agendamento, por exemplo)
export async function clearSession(phone: string) {
  await client.del(sessionKey(phone))
}
