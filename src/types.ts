// ============================================================
// Tipos principais do sistema
// ============================================================

export type MessageType = 'text' | 'audio' | 'document' | 'image' | 'video'

export interface WhatsAppMessage {
  instanceName: string
  data: {
    key: {
      remoteJid: string   // número do remetente ex: 5511999999999@s.whatsapp.net
      fromMe: boolean
      id: string
    }
    message: {
      conversation?: string           // texto simples
      extendedTextMessage?: { text: string }
      audioMessage?: {
        url: string
        mimetype: string
        seconds: number
        ptt: boolean                  // true = gravado no app (push-to-talk)
      }
      documentMessage?: {
        url: string
        mimetype: string
        fileName: string
        fileLength: number
      }
      imageMessage?: {
        url: string
        mimetype: string
        caption?: string
      }
    }
    messageType: string
    pushName: string                  // nome salvo no WhatsApp
  }
}

export interface ConversationSession {
  phone: string
  name: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  lastActivity: number
  context?: string                    // contexto extra (ex: "em processo de agendamento")
}

export interface ProcessedMessage {
  phone: string
  name: string
  type: MessageType
  text: string                        // tudo vira texto antes de ir para o Claude
  rawData?: unknown
}
