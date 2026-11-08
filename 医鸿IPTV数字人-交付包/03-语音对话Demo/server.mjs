/**
 * 医鸿 IPTV 数字人 · 语音对话 Demo 服务端
 * 零依赖：只用 Node 内置模块，不需要 npm install
 *
 * 职责只有三件：
 *   1. 托管 web/ 静态文件（麦克风必须在 localhost/HTTPS 下才可用，所以不能双击 HTML 打开）
 *   2. /api/chat  代理大模型（OpenAI 兼容协议，流式透传），避免 key 暴露在前端
 *   3. /api/asr   代理语音识别（OpenAI 兼容 /audio/transcriptions），用于浏览器内置识别不可用时的云端通道
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.join(__dirname, 'web')
const CONFIG_PATH = path.join(__dirname, 'config.json')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
}

/** 每次请求都重新读配置，改完 key 不用重启服务 */
async function loadConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  } catch {
    return { llm: { enabled: false }, asr: { enabled: false } }
  }
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
  res.end(body)
}

async function readBody(req, limit = 25 * 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > limit) throw new Error('BODY_TOO_LARGE')
    chunks.push(c)
  }
  return Buffer.concat(chunks)
}

/** 手搓 multipart，避免引第三方库 */
function buildMultipart(fields, file) {
  const boundary = '----yihong' + Math.random().toString(16).slice(2)
  const buf = []
  for (const [k, v] of Object.entries(fields)) {
    buf.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`))
  }
  if (file) {
    buf.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
          `Content-Type: ${file.contentType}\r\n\r\n`
      )
    )
    buf.push(file.data)
    buf.push(Buffer.from('\r\n'))
  }
  buf.push(Buffer.from(`--${boundary}--\r\n`))
  return { body: Buffer.concat(buf), contentType: `multipart/form-data; boundary=${boundary}` }
}

/* ---------------------------------------------------------------- 路由 */

async function handleConfig(res) {
  const cfg = await loadConfig()
  // 只暴露"能不能用"，绝不回传 key
  sendJSON(res, 200, {
    llm: { enabled: !!cfg.llm?.enabled && !!cfg.llm?.apiKey, model: cfg.llm?.model || '' },
    asr: { enabled: !!cfg.asr?.enabled && !!cfg.asr?.apiKey, model: cfg.asr?.model || '' },
    tts: { engine: cfg.tts?.engine || 'browser', rate: cfg.tts?.rate ?? 0.88 },
  })
}

async function handleChat(req, res) {
  const cfg = await loadConfig()
  const llm = cfg.llm || {}
  if (!llm.enabled || !llm.apiKey) return sendJSON(res, 400, { error: 'LLM_NOT_CONFIGURED' })

  let payload
  try {
    payload = JSON.parse((await readBody(req)).toString('utf8'))
  } catch {
    return sendJSON(res, 400, { error: 'BAD_JSON' })
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : []
  const body = JSON.stringify({
    model: llm.model || 'deepseek-chat',
    messages,
    stream: true,
    temperature: llm.temperature ?? 0.6,
    max_tokens: llm.maxTokens ?? 400,
  })

  let upstream
  try {
    upstream = await fetch(`${llm.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${llm.apiKey}`,
      },
      body,
    })
  } catch (e) {
    return sendJSON(res, 502, { error: 'UPSTREAM_UNREACHABLE', detail: String(e.message || e) })
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    return sendJSON(res, upstream.status, { error: 'UPSTREAM_ERROR', detail: text.slice(0, 500) })
  }

  // 上游 SSE 原样透传，前端按 data: 行解析
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(decoder.decode(value, { stream: true }))
    }
  } catch {
    /* 客户端中断，静默 */
  } finally {
    res.end()
  }
}

async function handleASR(req, res, url) {
  const cfg = await loadConfig()
  const asr = cfg.asr || {}
  if (!asr.enabled || !asr.apiKey) return sendJSON(res, 400, { error: 'ASR_NOT_CONFIGURED' })

  let audio
  try {
    audio = await readBody(req)
  } catch {
    return sendJSON(res, 413, { error: 'BODY_TOO_LARGE' })
  }
  if (!audio.length) return sendJSON(res, 400, { error: 'EMPTY_AUDIO' })

  const ext = url.searchParams.get('ext') || 'webm'
  const { body, contentType } = buildMultipart(
    { model: asr.model || 'FunAudioLLM/SenseVoiceSmall', language: 'zh' },
    { filename: `audio.${ext}`, contentType: `audio/${ext}`, data: audio }
  )

  let upstream
  try {
    upstream = await fetch(`${asr.baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${asr.apiKey}`, 'content-type': contentType },
      body,
    })
  } catch (e) {
    return sendJSON(res, 502, { error: 'UPSTREAM_UNREACHABLE', detail: String(e.message || e) })
  }

  const text = await upstream.text()
  if (!upstream.ok) return sendJSON(res, upstream.status, { error: 'UPSTREAM_ERROR', detail: text.slice(0, 500) })

  try {
    const j = JSON.parse(text)
    sendJSON(res, 200, { text: (j.text || '').trim() })
  } catch {
    sendJSON(res, 200, { text: text.trim() })
  }
}

/* ---------------------------------------------------------------- 静态 */

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname)
  if (rel === '/' || rel === '') rel = '/index.html'

  const filePath = path.join(WEB_ROOT, rel)
  // 防目录穿越
  if (!filePath.startsWith(WEB_ROOT)) {
    res.writeHead(403).end('forbidden')
    return
  }
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 not found: ' + rel)
    return
  }
  const data = await readFile(filePath)
  res.writeHead(200, {
    'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  })
  res.end(data)
}

/* ---------------------------------------------------------------- 启动 */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  try {
    if (url.pathname === '/api/config') return await handleConfig(res)
    if (url.pathname === '/api/chat' && req.method === 'POST') return await handleChat(req, res)
    if (url.pathname === '/api/asr' && req.method === 'POST') return await handleASR(req, res, url)
    return await serveStatic(req, res, url)
  } catch (e) {
    console.error('[server]', e)
    if (!res.headersSent) sendJSON(res, 500, { error: 'SERVER_ERROR', detail: String(e.message || e) })
    else res.end()
  }
})

const port = Number(process.env.PORT || 5173)
server.listen(port, '127.0.0.1', async () => {
  const cfg = await loadConfig()
  const has = (o) => (o?.enabled && o?.apiKey ? '已配置' : '未配置')
  console.log('')
  console.log('  医鸿 IPTV 数字人 · 语音对话 Demo')
  console.log('  ----------------------------------')
  console.log(`  打开：http://localhost:${port}`)
  console.log(`  大模型：${has(cfg.llm)}   语音识别：${has(cfg.asr)}`)
  console.log('')
  console.log('  提示：麦克风只能在 localhost 下使用，不要用 file:// 打开')
  console.log('  按 Ctrl+C 停止')
  console.log('')
})
