import Anthropic from '@anthropic-ai/sdk'
import type { ConversationSession } from '../types'

// ============================================================
// Serviço de IA — Claude (Anthropic)
// Este é o cérebro do bot. Toda mensagem do cliente (já
// convertida em texto) passa por aqui.
// ============================================================

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ============================================================
// SYSTEM PROMPT — personalize este bloco para cada cliente
// Este é o "manual de instruções" do bot. Quanto mais
// detalhado, mais preciso e humanizado será o atendimento.
// ============================================================
function buildSystemPrompt(companyContext: string): string {
  return `Você é um assistente virtual inteligente e humanizado de atendimento pelo WhatsApp.

${companyContext}

## Regras de comportamento:
- Responda SEMPRE em português brasileiro, de forma natural e cordial
- Seja direto e objetivo — respostas longas cansam no WhatsApp
- Use emojis com moderação (1-2 por mensagem no máximo)
- Nunca invente informações que não estão no contexto
- Se não souber algo, diga que vai verificar e peça contato
- Quando o cliente enviar áudio, confirme que ouviu antes de responder
- Quando receber documentos, confirme o recebimento e explique o que foi entendido

## Sobre agendamentos:
- Sempre confirme dia, horário e serviço antes de finalizar
- Se o horário solicitado não estiver disponível, ofereça alternativas
- Envie um resumo da confirmação ao final

## Tom de voz:
- Profissional mas acolhedor
- Nunca seja robótico ou frio
- Trate o cliente pelo nome quando possível`
}

// Contexto padrão da empresa (em produção, viria do banco de dados por cliente)
const DEFAULT_COMPANY_CONTEXT = `
## Empresa: Clínica Exemplo
- Serviços: Consultas, exames, procedimentos estéticos
- Horário de funcionamento: Segunda a sexta, 8h às 18h. Sábados, 8h às 12h.
- Endereço: Rua Exemplo, 123 — São Paulo/SP
- Telefone: (11) 99999-9999
- Site: www.clinicaexemplo.com.br
- Convênios aceitos: Unimed, Amil, SulAmérica, Bradesco Saúde
`

// ============================================================
// Função principal — gera resposta do Claude
// ============================================================
export async function generateReply(
  session: ConversationSession,
  userMessage: string,
  companyContext: string = DEFAULT_COMPANY_CONTEXT
): Promise<string> {
  // Monta o histórico de mensagens para enviar ao Claude
  // (inclui toda a conversa para manter o contexto)
  const messages = [
    ...session.messages,
    { role: 'user' as const, content: userMessage },
  ]

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: buildSystemPrompt(companyContext),
    messages,
  })

  const reply = response.content[0].type === 'text'
    ? response.content[0].text
    : 'Desculpe, não consegui processar sua mensagem. Pode tentar novamente?'

  return reply
}
