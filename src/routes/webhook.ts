import type { FastifyInstance } from 'fastify'
import type { WhatsAppMessage } from '../types'
import { getOrCreateSession, addMessageToSession } from '../services/session'
import { generateReply } from '../services/claude'
import { transcribeAudio, processDocument } from '../services/media'
import { sendText, sendTyping } from '../services/whatsapp'

// ============================================================
// Webhook — ponto de entrada de todas as mensagens
//
// Fluxo completo:
//  WhatsApp → Evolution API → POST /webhook → aqui
//  → detecta tipo → converte para texto → Claude → responde
// ============================================================

export async function webhookRoute(app: FastifyInstance) {
  app.post<{ Body: WhatsAppMessage }>('/webhook', async (request, reply) => {
    const body = request.body

    // Ignora mensagens enviadas pelo próprio bot
    if (body?.data?.key?.fromMe) {
      return reply.send({ ok: true })
    }

    // Só processa eventos de mensagem
    if (!body?.data?.message) {
      return reply.send({ ok: true })
    }

    const { key, message, pushName, messageType } = body.data
    const phone = key.remoteJid.replace('@s.whatsapp.net', '')
    const name  = pushName ?? 'Cliente'

    app.log.info(`[Webhook] mensagem de ${name} (${phone}) — tipo: ${messageType}`)

    // Responde imediatamente ao WhatsApp (evita timeout do webhook)
    reply.send({ ok: true })

    // Processa de forma assíncrona para não bloquear o webhook
    handleMessage({ phone, name, message, messageType }).catch((err) =>
      app.log.error({ err }, '[handleMessage] erro ao processar mensagem')
    )
  })
}

// ============================================================
// Processador assíncrono de mensagens
// ============================================================
async function handleMessage({
  phone,
  name,
  message,
  messageType,
}: {
  phone: string
  name: string
  message: WhatsAppMessage['data']['message']
  messageType: string
}) {
  try {
    // 1. Busca ou cria a sessão de conversa
    const session = await getOrCreateSession(phone, name)

    // 2. Extrai/converte o conteúdo da mensagem para texto
    let userText = ''

    // --- Texto simples ---
    if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
      userText = message.conversation ?? message.extendedTextMessage?.text ?? ''
    }

    // --- Áudio (ptt = push-to-talk, gravado no app) ---
    else if (messageType === 'audioMessage' && message.audioMessage) {
      await sendTyping(phone, 3000)
      userText = await transcribeAudio(message.audioMessage.url)
    }

    // --- Documento (PDF, Word, Excel) ---
    else if (messageType === 'documentMessage' && message.documentMessage) {
      await sendTyping(phone, 4000)
      userText = await processDocument(
        message.documentMessage.url,
        message.documentMessage.mimetype,
        message.documentMessage.fileName
      )
    }

    // --- Imagem ---
    else if (messageType === 'imageMessage' && message.imageMessage) {
      const caption = message.imageMessage.caption ?? ''
      userText = `[Imagem recebida]${caption ? ` — legenda: "${caption}"` : ''}`
      // TODO fase 2: passar imagem para Claude Vision
    }

    // --- Tipo não suportado ainda ---
    else {
      await sendText(phone, 'Recebi sua mensagem, mas ainda não consigo processar esse tipo de conteúdo. Pode me enviar um texto? 😊')
      return
    }

    if (!userText.trim()) return

    // 3. Simula digitação enquanto o Claude processa
    await sendTyping(phone, 2000)

    // 4. Salva mensagem do usuário na sessão
    await addMessageToSession(phone, 'user', userText)

    // 5. Gera resposta com o Claude
    const reply = await generateReply(session, userText)

    // 6. Salva resposta do bot na sessão
    await addMessageToSession(phone, 'assistant', reply)

    // 7. Envia resposta ao cliente
    await sendText(phone, reply)

  } catch (error) {
    console.error('[handleMessage] erro:', error)
    // Envia mensagem de fallback para não deixar o cliente no vácuo
    await sendText(
      phone,
      'Desculpe, tive um problema técnico agora. Pode repetir sua mensagem? 🙏'
    ).catch(() => {}) // silencia erro de envio
  }
}
