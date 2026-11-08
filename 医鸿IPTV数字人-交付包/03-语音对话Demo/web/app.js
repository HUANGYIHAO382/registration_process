import { Avatar } from './avatar.js'
import { VoiceInput } from './voice.js'
import { Brain, DEFAULT_SYSTEM_PROMPT, EMERGENCY_REPLY } from './brain.js'

/* ------------------------------------------------------------ 舞台缩放 */

const stage = document.getElementById('stage')
function fitStage() {
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
  stage.style.transform = `scale(${s})`
  stage.style.left = (window.innerWidth - 1920 * s) / 2 + 'px'
  stage.style.top = (window.innerHeight - 1080 * s) / 2 + 'px'
}
window.addEventListener('resize', fitStage)
fitStage()

/* ------------------------------------------------------------ DOM */

const $ = (id) => document.getElementById(id)
const el = {
  avatar: $('avatar'),
  wave: $('wave'),
  badge: $('badge'),
  statusText: $('statusText'),
  userLine: $('userLine'),
  botLine: $('botLine'),
  tip: $('tip'),
  emergency: $('emergency'),
  voiceHint: $('voiceHint'),
  toast: $('toast'),
  channels: $('channels'),
  typeInput: $('typeInput'),
  nameTag: $('nameTag'),
}

/* ------------------------------------------------------------ 波形 */

const WAVE_BARS = 9
const waveBars = []
for (let i = 0; i < WAVE_BARS; i++) {
  const b = document.createElement('i')
  el.wave.appendChild(b)
  waveBars.push({ node: b, v: 0 })
}
let level = 0
let waveActive = false

function tickWave() {
  waveBars.forEach((b, i) => {
    const center = 1 - Math.abs(i - (WAVE_BARS - 1) / 2) / ((WAVE_BARS - 1) / 2)
    const jitter = waveActive ? 0.65 + Math.random() * 0.7 : 0
    const target = waveActive ? level * (0.35 + center * 1.15) * jitter : 0
    b.v += (target - b.v) * 0.42
    b.node.style.transform = `scaleY(${(0.12 + b.v * 1.08).toFixed(2)})`
  })
  requestAnimationFrame(tickWave)
}
requestAnimationFrame(tickWave)

function setWave(active) {
  waveActive = active
  el.wave.classList.toggle('active', active)
}

/* ------------------------------------------------------------ 数字人 */

const avatar = new Avatar(el.avatar, 'nurse')
avatar.setEmotion('neutral')

/* ------------------------------------------------------------ 状态机 */

const S = { IDLE: 'IDLE', LISTENING: 'LISTENING', THINKING: 'THINKING', SPEAKING: 'SPEAKING', EMERGENCY: 'EMERGENCY' }
let state = S.IDLE

const STATUS_TEXT = {
  IDLE: '按空格键，直接说话就可以',
  LISTENING: '正在听… 说完停一下就好',
  THINKING: '我记一下…',
  SPEAKING: '按空格键可以打断我',
  EMERGENCY: '已进入紧急提示，请先拨打 120',
}
const HINT_TEXT = {
  IDLE: '按空格键开始说话',
  LISTENING: '正在听…',
  THINKING: '想一下…',
  SPEAKING: '正在说…',
  EMERGENCY: '紧急提示',
}

function setState(s) {
  state = s
  el.badge.textContent = { IDLE: '待机', LISTENING: '正在听', THINKING: '思考中', SPEAKING: '正在回答', EMERGENCY: '紧急' }[s]
  el.badge.dataset.s = s
  el.statusText.textContent = STATUS_TEXT[s]
  el.voiceHint.textContent = HINT_TEXT[s]
  el.voiceHint.classList.toggle('live', s === S.LISTENING || s === S.SPEAKING)
}

/* ------------------------------------------------------------ 提示条 */

let toastTimer = null
function toast(msg, kind = 'warn', ms = 5200) {
  el.toast.textContent = msg
  el.toast.className = 'toast show' + (kind === 'info' ? ' info' : '')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms)
}

/* ------------------------------------------------------------ 语音合成（TTS） */

const speaker = {
  rate: 0.88,
  voice: null,
  ready: false,
  init() {
    if (!('speechSynthesis' in window)) return
    const load = () => {
      const vs = speechSynthesis.getVoices()
      if (!vs.length) return
      this.voice =
        vs.find((v) => /^zh[-_]CN/i.test(v.lang) && /xiaoxiao|huihui|yaoyao|kangkang|female/i.test(v.name)) ||
        vs.find((v) => /^zh/i.test(v.lang)) ||
        null
      this.ready = true
    }
    load()
    speechSynthesis.onvoiceschanged = load
  },
}

/* ------------------------------------------------------------ 打字机字幕 */

let botSpans = []
let botChars = ''
let hiIndex = -1

function resetBotLine() {
  el.botLine.innerHTML = ''
  botSpans = []
  botChars = ''
  hiIndex = -1
}

function appendBotText(t) {
  botChars += t
  const frag = document.createDocumentFragment()
  for (const c of t) {
    const sp = document.createElement('span')
    sp.className = 'ch'
    sp.textContent = c
    frag.appendChild(sp)
    botSpans.push(sp)
  }
  el.botLine.appendChild(frag)
}

function highlightTo(i) {
  if (i === hiIndex) return
  for (let k = hiIndex; k < Math.min(i, botSpans.length); k++) {
    if (botSpans[k]) botSpans[k].classList.add('said')
  }
  if (botSpans[hiIndex]) botSpans[hiIndex].classList.remove('on')
  hiIndex = i
  if (botSpans[i]) botSpans[i].classList.add('on')
}

/* ------------------------------------------------------------ 播报队列 */

let speakQueue = []
let speaking = false
let interruptFlag = false

function enqueueSpeech(text, start) {
  speakQueue.push({ text, start })
  if (!speaking) drainSpeech()
}

async function drainSpeech() {
  speaking = true
  setWave(true)
  avatar.startSpeak()
  setState(S.SPEAKING)

  // 播放时没有真实音频电平，用包络伪造一个，让波形跟着说话起伏
  const lvTimer = setInterval(() => {
    level = 0.32 + Math.abs(Math.sin(performance.now() / 135)) * 0.52
  }, 80)

  while (speakQueue.length) {
    const item = speakQueue.shift()
    if (interruptFlag) break
    await speakOne(item)
  }

  clearInterval(lvTimer)
  speaking = false
  setWave(false)
  avatar.stopSpeak()
  level = 0
  if (interruptFlag) {
    interruptFlag = false
    return
  }
  if (state === S.SPEAKING) setState(S.IDLE)
}

function speakOne({ text, start }) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      // 没有 TTS：按字数模拟节奏，字幕照常走
      let i = 0
      const t = setInterval(() => {
        i += 1
        highlightTo(start + i)
        if (i > text.length) {
          clearInterval(t)
          resolve()
        }
      }, 190)
      return
    }

    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = speaker.rate
    u.pitch = 1.02
    if (speaker.voice) u.voice = speaker.voice

    let idx = 0
    let timer = null
    const stopTimer = () => timer && clearInterval(timer)

    u.onboundary = (e) => {
      if (typeof e.charIndex === 'number') {
        idx = e.charIndex
        highlightTo(start + idx)
      }
    }

    u.onstart = () => {
      // 兜底节奏：每 200ms 走一个字，boundary 来了会被纠正
      timer = setInterval(() => {
        idx = Math.min(idx + 1, text.length)
        highlightTo(start + idx)
      }, 200)
    }

    u.onend = () => {
      stopTimer()
      highlightTo(start + text.length)
      setTimeout(resolve, 120)
    }
    u.onerror = () => {
      stopTimer()
      setTimeout(resolve, 60)
    }

    try {
      speechSynthesis.speak(u)
    } catch {
      stopTimer()
      resolve()
    }
  })
}

function interruptSpeech() {
  interruptFlag = true
  speakQueue = []
  try {
    speechSynthesis.cancel()
  } catch {}
  speaking = false
  setWave(false)
  avatar.stopSpeak()
}

/* ------------------------------------------------------------ 语音输入 */

let voice = null
let channel = 'browser'
let cfg = { llm: { enabled: false }, asr: { enabled: false }, tts: {} }

const MOCK_LINES = [
  '我这两天血压有点高',
  '帮我挂个心内科的号',
  '我的检查报告出来了吗',
  '早上忘吃药了怎么办',
]

function createVoice(ch) {
  return new VoiceInput({
    channel: ch,
    mockLines: MOCK_LINES,
    onEvent: onVoiceEvent,
  })
}

function onVoiceEvent(type, data) {
  switch (type) {
    case 'ready':
      setState(S.LISTENING)
      setWave(true)
      el.userLine.textContent = ''
      el.userLine.classList.add('live')
      avatar.setEmotion('listen')
      break

    case 'level':
      level = Math.max(level * 0.55, data.value || 0)
      break

    case 'partial':
      el.userLine.textContent = data.text
      break

    case 'speechstart':
      break

    case 'thinking':
      setWave(false)
      setState(S.THINKING)
      break

    case 'final':
      setWave(false)
      el.userLine.classList.remove('live')
      el.userLine.textContent = data.text
      voice = null
      handleTurn(data.text)
      break

    case 'error':
      setWave(false)
      voice = null
      setState(S.IDLE)
      avatar.setEmotion('neutral')
      onVoiceError(data)
      break

    case 'end':
      if (state === S.LISTENING) {
        setWave(false)
        setState(S.IDLE)
        avatar.setEmotion('neutral')
        if (data.reason === 'empty') toast('没听清，您再说一遍', 'info', 2600)
      }
      voice = null
      break
  }
}

function onVoiceError(d) {
  // 浏览器识别最典型的失败是走不通 Google 服务，这时自动降级，别让演示卡住
  if (d.code === 'network' || d.code === 'service-not-allowed') {
    if (cfg.asr.enabled) {
      switchChannel('cloud', true)
      toast('浏览器识别连不上，已切到云端识别，请再说一次', 'info', 5000)
    } else {
      switchChannel('mock', true)
      toast('浏览器识别连不上（国内网络常见），已切到演示模式。要真识别请在 config.json 配 ASR key', 'warn', 7000)
    }
    return
  }
  toast(d.message || '语音出错了', 'warn', 5000)
}

/* ------------------------------------------------------------ 对话大脑 */

const brain = new Brain({ llmEnabled: false, systemPrompt: DEFAULT_SYSTEM_PROMPT })

let turnAbort = null

async function handleTurn(text) {
  if (!text.trim()) return
  el.userLine.textContent = text
  el.tip.classList.add('hide')
  el.emergency.classList.remove('show')

  resetBotLine()
  setState(S.THINKING)
  avatar.setEmotion('neutral')

  let pending = ''
  let emitted = 0 // 已入播报队列的字符数（作为高亮偏移）

  const control = new AbortController()
  turnAbort = control

  try {
    for await (const chunk of brain.ask(text)) {
      if (control.signal.aborted) return
      const d = chunk.delta || ''
      if (!d) continue
      appendBotText(d)
      pending += d

      // 按句切分送 TTS：首句完整就开说，不等全文
      let m
      while ((m = pending.match(/^[\s\S]*?[。！？；\n]/))) {
        const sentence = m[0]
        if (!sentence.trim()) {
          pending = pending.slice(sentence.length)
          continue
        }
        enqueueSpeech(sentence, emitted)
        emitted += sentence.length
        pending = pending.slice(sentence.length)
      }

      if (chunk.emergency) {
        showEmergency()
      }
    }
    if (pending.trim()) {
      enqueueSpeech(pending, emitted)
      emitted += pending.length
    }
  } catch (e) {
    console.error(e)
  }
}

/* ------------------------------------------------------------ 危急 */

function showEmergency() {
  setState(S.EMERGENCY)
  el.emergency.classList.add('show')
  avatar.setEmotion('alert')
}

function clearEmergency() {
  el.emergency.classList.remove('show')
  avatar.setEmotion('neutral')
  setState(S.IDLE)
}

function runEmergencyDemo() {
  interruptSpeech()
  resetBotLine()
  el.tip.classList.add('hide')
  const text = '我胸口疼，喘不上气'
  el.userLine.textContent = text
  showEmergency()
  let start = 0
  for (const s of EMERGENCY_REPLY.split(/(?<=[。！？])/).filter(Boolean)) {
    appendBotText(s)
    enqueueSpeech(s, start)
    start += s.length
  }
  brain.history.push({ role: 'user', content: text })
  brain.history.push({ role: 'assistant', content: EMERGENCY_REPLY })
}

/* ------------------------------------------------------------ 主流程控制 */

function startListening() {
  if (state === S.EMERGENCY) {
    interruptSpeech()
    clearEmergency()
    return
  }
  if (speaking) {
    interruptSpeech()
  }
  if (voice) {
    // 正在听，再按一次 = 提前结束
    voice.stop()
    return
  }
  el.emergency.classList.remove('show')
  el.userLine.textContent = ''
  el.userLine.classList.add('live')
  voice = createVoice(channel)
  voice.start()
}

function hardInterrupt() {
  interruptSpeech()
  if (voice) {
    voice.abort()
    voice = null
  }
  if (turnAbort) turnAbort.abort()
  brain.abort()
  setWave(false)
  avatar.stopSpeak()
  avatar.setEmotion('neutral')
  if (state !== S.EMERGENCY) setState(S.IDLE)
}

/* ------------------------------------------------------------ 通道切换 */

const CHANNELS = [
  { id: 'browser', label: '浏览器识别', sub: '零配置' },
  { id: 'cloud', label: '云端识别', sub: '需 key' },
  { id: 'mock', label: '演示模式', sub: '剧本' },
]

function renderChannels() {
  el.channels.innerHTML = ''
  for (const c of CHANNELS) {
    const b = document.createElement('button')
    b.className = 'chanBtn'
    b.textContent = c.label
    b.dataset.id = c.id
    const unavailable = c.id === 'cloud' && !cfg.asr.enabled
    if (unavailable) b.classList.add('off')
    if (c.id === channel) b.classList.add('on')
    b.onclick = () => {
      if (unavailable) {
        toast('云端识别还没配 key。在 demo-voice/config.json 里填 asr.apiKey 后刷新页面即可', 'warn', 6000)
        return
      }
      switchChannel(c.id)
    }
    el.channels.appendChild(b)
  }
}

function switchChannel(id, silent) {
  hardInterrupt()
  channel = id
  renderChannels()
  const name = CHANNELS.find((c) => c.id === id)?.label || id
  if (!silent) toast(`已切换到「${name}」`, 'info', 2200)
}

/* ------------------------------------------------------------ 键盘 */

window.addEventListener('keydown', (e) => {
  if (e.target === el.typeInput) {
    if (e.key === 'Enter') {
      const v = el.typeInput.value.trim()
      el.typeInput.value = ''
      if (v) {
        interruptSpeech()
        handleTurn(v)
      }
    }
    return
  }

  if (e.code === 'Space') {
    e.preventDefault()
    startListening()
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    if (state === S.EMERGENCY) clearEmergency()
    else hardInterrupt()
    return
  }
  if (e.key === '1') switchChannel('browser')
  if (e.key === '2') {
    if (cfg.asr.enabled) switchChannel('cloud')
    else toast('云端识别还没配 key（config.json 里的 asr.apiKey）', 'warn', 5000)
  }
  if (e.key === '3') switchChannel('mock')
  if (e.key === 'h' || e.key === 'H') runEmergencyDemo()
})

// 点建议句 = 直接走一轮对话
document.querySelectorAll('.tipItem').forEach((node) => {
  node.onclick = () => {
    interruptSpeech()
    handleTurn(node.textContent)
  }
})

/* ------------------------------------------------------------ 启动 */

async function boot() {
  speaker.init()

  try {
    const r = await fetch('/api/config')
    cfg = await r.json()
  } catch {
    cfg = { llm: { enabled: false }, asr: { enabled: false }, tts: {} }
  }

  brain.llmEnabled = !!cfg.llm?.enabled
  if (cfg.tts?.rate) speaker.rate = cfg.tts.rate

  // 默认通道：配了 ASR 就用云端（最稳），否则浏览器识别（零配置），都不行就演示模式
  const hasSR = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  channel = cfg.asr?.enabled ? 'cloud' : hasSR ? 'browser' : 'mock'

  renderChannels()
  setState(S.IDLE)

  const mode = cfg.llm?.enabled ? '大模型' : '内置剧本'
  console.log(`[demo] 语音通道=${channel} 对话=${mode}`)
}

boot()
