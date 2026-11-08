/**
 * 本地代理 + Mock 挂号服务（零业务密钥进前端）
 * 端口 8787；Vite 把 /api 代理过来
 *
 * 能力：
 *  - GET  /api/health
 *  - GET  /api/config（无 Key）
 *  - POST /api/chat  /api/asr
 *  - 绑定 / 家庭 / 号源 / 预占确认
 *  - 实验日志写入与导出
 */
import { createServer } from 'node:http'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.join(__dirname, 'config.json')
const PATIENTS_PATH = path.join(__dirname, 'mock', 'patients.json')
const DATA_DIR = path.join(__dirname, 'data')
const EXP_PATH = path.join(DATA_DIR, 'experiment.jsonl')
const PORT = 8787

/** 内存态：绑定会话、预占、运行时激活 */
const runtime = {
  bindVariant: 'A',
  asrActive: 'asr.mock',
  llmActive: 'llm.script',
  bindSessions: new Map(),
  holds: new Map(),
  orders: new Map(),
}

async function loadConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  } catch {
    return { llm: { enabled: false }, asr: { enabled: false }, bind: { activeVariant: 'A' } }
  }
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  })
  res.end(body)
}

function sendText(res, code, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'content-type': type, 'access-control-allow-origin': '*' })
  res.end(text)
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

function parseUrl(req) {
  return new URL(req.url, `http://127.0.0.1:${PORT}`)
}

function checkDevAuth(req) {
  const h = req.headers.authorization || ''
  return h === 'Bearer demo-dev-token' || h.startsWith('Bearer ')
}

async function handleConfig(res) {
  const cfg = await loadConfig()
  if (cfg.bind?.activeVariant) runtime.bindVariant = cfg.bind.activeVariant
  sendJSON(res, 200, {
    asr: {
      enabled: !!cfg.asr?.enabled && !!cfg.asr?.apiKey,
      activeId: runtime.asrActive,
      model: cfg.asr?.model || '',
      providers: [
        { id: 'asr.browser', enabled: true, label: '浏览器识别' },
        { id: 'asr.cloud', enabled: !!cfg.asr?.enabled && !!cfg.asr?.apiKey, label: '云端 ASR' },
        { id: 'asr.mock', enabled: true, label: '演示剧本' },
      ],
    },
    llm: {
      enabled: !!cfg.llm?.enabled && !!cfg.llm?.apiKey,
      activeId: runtime.llmActive,
      model: cfg.llm?.model || '',
      providers: [
        { id: 'llm.script', enabled: true, label: '本地剧本' },
        { id: 'llm.cloud', enabled: !!cfg.llm?.enabled && !!cfg.llm?.apiKey, label: '云端大模型' },
      ],
    },
    tts: { engine: cfg.tts?.engine || 'browser', rate: cfg.tts?.rate ?? 0.88 },
    bind: { activeVariant: runtime.bindVariant, variants: ['A', 'B', 'C'] },
    params: { asr: { language: 'zh-CN', lowConfidence: 0.6 } },
  })
}

async function handleChat(req, res) {
  const cfg = await loadConfig()
  const llm = cfg.llm || {}
  if (!llm.enabled || !llm.apiKey) return sendJSON(res, 400, { code: 'LLM_NOT_CONFIGURED', message: '未配置大模型' })

  let payload
  try {
    payload = JSON.parse((await readBody(req)).toString('utf8'))
  } catch {
    return sendJSON(res, 400, { code: 'BAD_JSON', message: '请求体不是 JSON' })
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
    return sendJSON(res, 502, { code: 'UPSTREAM', message: '大模型连不上', detail: String(e.message || e) })
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    return sendJSON(res, upstream.status, { code: 'UPSTREAM', message: '大模型报错', detail: text.slice(0, 500) })
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'access-control-allow-origin': '*',
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
    /* 客户端断开 */
  } finally {
    res.end()
  }
}

async function handleAsr(req, res, url) {
  const cfg = await loadConfig()
  const asr = cfg.asr || {}
  if (!asr.enabled || !asr.apiKey) return sendJSON(res, 400, { code: 'ASR_NOT_CONFIGURED', message: '未配置语音识别' })

  const ext = url.searchParams.get('ext') || 'webm'
  const raw = await readBody(req)
  const { body, contentType } = buildMultipart(
    { model: asr.model || 'whisper-1', language: 'zh' },
    { filename: `audio.${ext}`, contentType: `audio/${ext}`, data: raw }
  )

  let upstream
  try {
    upstream = await fetch(`${asr.baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${asr.apiKey}`, 'content-type': contentType },
      body,
    })
  } catch (e) {
    return sendJSON(res, 502, { code: 'UPSTREAM', message: 'ASR 连不上', detail: String(e.message || e) })
  }
  const text = await upstream.text()
  if (!upstream.ok) return sendJSON(res, upstream.status, { code: 'UPSTREAM', message: 'ASR 失败', detail: text.slice(0, 500) })
  try {
    const j = JSON.parse(text)
    return sendJSON(res, 200, { text: j.text || '' })
  } catch {
    return sendJSON(res, 200, { text })
  }
}

function handleBindVariant(req, res, body) {
  const v = body.variant
  if (!['A', 'B', 'C'].includes(v)) return sendJSON(res, 400, { code: 'VALIDATION', message: 'variant 只能是 A/B/C' })
  runtime.bindVariant = v
  return sendJSON(res, 200, { ok: true, activeVariant: v })
}

function handleBindSession(res, body) {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const sessionId = 'bs_' + Date.now().toString(16) + Math.random().toString(16).slice(2, 6)
  const expiresInSec = 180
  runtime.bindSessions.set(sessionId, {
    code,
    deviceId: body.deviceId || '',
    variant: body.variant || runtime.bindVariant,
    expiresAt: Date.now() + expiresInSec * 1000,
  })
  return sendJSON(res, 200, {
    sessionId,
    code,
    expiresInSec,
    variant: body.variant || runtime.bindVariant,
    qrPayload: `yihong://bind?s=${sessionId}&c=${code}`,
  })
}

function handleBindConfirm(res, body) {
  const s = runtime.bindSessions.get(body.sessionId)
  if (!s) return sendJSON(res, 404, { code: 'NOT_FOUND', message: '绑定会话不存在' })
  if (Date.now() > s.expiresAt) return sendJSON(res, 400, { code: 'BIND_EXPIRED', message: '绑定码已过期' })
  if (String(body.code) !== String(s.code)) {
    return sendJSON(res, 400, { code: 'BIND_CODE_INVALID', message: '绑定码不正确' })
  }
  runtime.bindSessions.delete(body.sessionId)
  const token = 'tok_' + Math.random().toString(16).slice(2) + Date.now().toString(16)
  return sendJSON(res, 200, {
    deviceSessionToken: token,
    familyId: 'fam_demo',
    message: '绑定成功',
  })
}

async function handlePatients(res) {
  try {
    const data = JSON.parse(await readFile(PATIENTS_PATH, 'utf8'))
    return sendJSON(res, 200, data)
  } catch {
    return sendJSON(res, 200, { patients: [] })
  }
}

function handleSlots(url, res) {
  const department = url.searchParams.get('department') || '心血管内科'
  const slots = [
    { slotId: 'slot_1', label: '明天上午九点', doctorName: '王医生', clinicType: '普通门诊', remain: 5, department },
    { slotId: 'slot_2', label: '明天上午九点半', doctorName: '李医生', clinicType: '普通门诊', remain: 3, department },
    { slotId: 'slot_3', label: '后天下午两点', doctorName: '赵医生', clinicType: '普通门诊', remain: 8, department },
  ]
  return sendJSON(res, 200, { department, slots })
}

function handleHold(res, body, idem) {
  const holdId = 'hold_' + (idem || Date.now().toString(16))
  if (runtime.holds.has(holdId)) {
    return sendJSON(res, 200, runtime.holds.get(holdId))
  }
  const ttlSec = 120
  const record = {
    holdId,
    slotId: body.slotId,
    patientId: body.patientId,
    department: body.department,
    expiresAt: Date.now() + ttlSec * 1000,
    ttlSec,
  }
  runtime.holds.set(holdId, record)
  return sendJSON(res, 200, record)
}

function handleConfirm(res, body, idem) {
  const hold = runtime.holds.get(body.holdId)
  if (!hold) return sendJSON(res, 404, { code: 'NOT_FOUND', message: '预占不存在' })
  if (Date.now() > hold.expiresAt) return sendJSON(res, 400, { code: 'HOLD_EXPIRED', message: '号源预留已过期，请重新选择' })

  const orderId = 'ord_' + (idem || Date.now().toString(16))
  if (runtime.orders.has(orderId)) return sendJSON(res, 200, runtime.orders.get(orderId))

  const ticketNo = 'A' + String(Math.floor(10 + Math.random() * 89))
  const order = {
    orderId,
    ticketNo,
    holdId: hold.holdId,
    slotId: hold.slotId,
    patientId: hold.patientId,
    department: hold.department,
    payHint: '到院缴费',
    status: 'RESERVED',
  }
  runtime.orders.set(orderId, order)
  runtime.holds.delete(body.holdId)
  return sendJSON(res, 200, order)
}

async function handleExperimentLog(body, res) {
  // 约定：不写身份证明文
  const line = JSON.stringify({ ...body, serverTs: Date.now() }) + '\n'
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
  await appendFile(EXP_PATH, line, 'utf8')
  return sendJSON(res, 200, { ok: true })
}

async function handleExperimentExport(res) {
  if (!existsSync(EXP_PATH)) return sendText(res, 200, '', 'application/x-ndjson; charset=utf-8')
  const text = await readFile(EXP_PATH, 'utf8')
  res.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'content-disposition': 'attachment; filename="bind-experiment.jsonl"',
    'access-control-allow-origin': '*',
  })
  res.end(text)
}

const server = createServer(async (req, res) => {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,x-idempotency-key',
    })
    return res.end()
  }

  const url = parseUrl(req)
  const p = url.pathname

  try {
    if (req.method === 'GET' && p === '/api/health') return sendJSON(res, 200, { ok: true })
    if (req.method === 'GET' && p === '/api/config') return handleConfig(res)
    if (req.method === 'POST' && p === '/api/chat') return handleChat(req, res)
    if (req.method === 'POST' && p === '/api/asr') return handleAsr(req, res, url)

    if (req.method === 'POST' && p === '/api/bind/variant') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
      return handleBindVariant(req, res, body)
    }
    if (req.method === 'POST' && p === '/api/bind/session') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
      return handleBindSession(res, body)
    }
    if (req.method === 'POST' && p === '/api/bind/confirm') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
      return handleBindConfirm(res, body)
    }

    if (req.method === 'GET' && p === '/api/family/patients') return handlePatients(res)
    if (req.method === 'GET' && p === '/api/schedule/slots') return handleSlots(url, res)

    if (req.method === 'POST' && p === '/api/order/hold') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
      const idem = req.headers['x-idempotency-key']
      return handleHold(res, body, idem)
    }
    if (req.method === 'POST' && p === '/api/order/confirm') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
      const idem = req.headers['x-idempotency-key']
      return handleConfirm(res, body, idem)
    }

    if (req.method === 'POST' && p === '/api/experiment/log') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
      return handleExperimentLog(body, res)
    }
    if (req.method === 'GET' && p === '/api/experiment/export') return handleExperimentExport(res)

    // 控制面激活（Demo 宽松鉴权）
    if (req.method === 'POST' && p === '/api/providers/activate') {
      if (!checkDevAuth(req)) return sendJSON(res, 403, { code: 'FORBIDDEN_CONTROL', message: '需要开发者令牌' })
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
      if (body.type === 'asr') runtime.asrActive = body.id
      if (body.type === 'llm') runtime.llmActive = body.id
      return sendJSON(res, 200, { ok: true })
    }

    sendJSON(res, 404, { code: 'NOT_FOUND', message: '接口不存在' })
  } catch (e) {
    console.error(e)
    sendJSON(res, 500, { code: 'INTERNAL', message: '服务器错误', detail: String(e.message || e) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[iptv-demo-server] http://127.0.0.1:${PORT}`)
})
