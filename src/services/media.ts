import fs from 'fs'
import path from 'path'
import os from 'os'
import axios from 'axios'
import FormData from 'form-data'

// ============================================================
// Serviço de mídia
// Converte áudio, documentos e imagens em texto
// para que o Claude processe tudo da mesma forma.
// ============================================================

// --- ÁUDIO → texto via Whisper API ----------------------------
export async function transcribeAudio(audioUrl: string): Promise<string> {
  // 1. Baixa o arquivo de áudio temporariamente
  const tmpPath = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`)
  const response = await axios.get(audioUrl, { responseType: 'arraybuffer' })
  fs.writeFileSync(tmpPath, Buffer.from(response.data))

  // 2. Envia para a API do Whisper
  const form = new FormData()
  form.append('file', fs.createReadStream(tmpPath), { filename: 'audio.ogg' })
  form.append('model', 'whisper-1')
  form.append('language', 'pt')    // força português para melhor precisão

  const whisperResponse = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  )

  // 3. Limpa o arquivo temporário
  fs.unlinkSync(tmpPath)

  return `[Áudio transcrito]: ${whisperResponse.data.text}`
}

// --- PDF → texto -----------------------------------------------
export async function extractPdfText(fileUrl: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default

  const response = await axios.get(fileUrl, { responseType: 'arraybuffer' })
  const buffer = Buffer.from(response.data)
  const data = await pdfParse(buffer)

  // Limita a 8000 caracteres para não explodir o contexto do LLM
  const text = data.text.trim().slice(0, 8000)
  const truncated = data.text.length > 8000 ? '\n[... documento truncado após 8000 caracteres]' : ''

  return `[Documento PDF — ${data.numpages} páginas]:\n${text}${truncated}`
}

// --- Word (.docx) → texto --------------------------------------
export async function extractWordText(fileUrl: string): Promise<string> {
  const mammoth = await import('mammoth')

  const response = await axios.get(fileUrl, { responseType: 'arraybuffer' })
  const buffer = Buffer.from(response.data)
  const result = await mammoth.extractRawText({ buffer })

  const text = result.value.trim().slice(0, 8000)
  return `[Documento Word]:\n${text}`
}

// --- Excel (.xlsx) → texto -------------------------------------
export async function extractExcelText(fileUrl: string): Promise<string> {
  const XLSX = await import('xlsx')

  const response = await axios.get(fileUrl, { responseType: 'arraybuffer' })
  const buffer = Buffer.from(response.data)
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  // Converte todas as abas em texto
  const lines: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    lines.push(`[Aba: ${sheetName}]\n${csv}`)
  }

  const text = lines.join('\n\n').slice(0, 8000)
  return `[Planilha Excel]:\n${text}`
}

// --- Roteador de documentos ------------------------------------
export async function processDocument(
  fileUrl: string,
  mimetype: string,
  fileName: string
): Promise<string> {
  if (mimetype === 'application/pdf') {
    return extractPdfText(fileUrl)
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    return extractWordText(fileUrl)
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-excel'
  ) {
    return extractExcelText(fileUrl)
  }

  return `[Arquivo recebido: ${fileName}] — tipo não suportado ainda (${mimetype})`
}
