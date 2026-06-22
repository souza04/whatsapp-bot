import 'dotenv/config'
import Fastify from 'fastify'
import { connectRedis } from './services/session'
import { webhookRoute } from './routes/webhook'

// ============================================================
// Servidor principal
// ============================================================

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',   // logs coloridos no desenvolvimento
      options: { colorize: true },
    },
  },
})

async function bootstrap() {
  // 1. Conecta ao Redis
  await connectRedis()

  // 2. Registra as rotas
  await app.register(webhookRoute)

  // 3. Rota de health check (Railway, Docker e afins usam isso)
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // 4. Sobe o servidor
  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })

  console.log(`
╔══════════════════════════════════════╗
║   🤖 WhatsApp AI Bot — rodando!      ║
║   Porta: ${port}                        ║
║   Webhook: POST /webhook             ║
║   Health:  GET  /health              ║
╚══════════════════════════════════════╝
  `)
}

bootstrap().catch((err) => {
  console.error('❌ Erro ao iniciar:', err)
  process.exit(1)
})
