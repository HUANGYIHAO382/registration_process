/**
 * VoiceInput —— 语音输入层的唯一出口
 * 上层（app.js）只允许调用 start/stop/abort + 监听事件，不允许碰 MediaStream。
 *
 * 三条通道，现场哪条通走哪条：
 *   browser : 浏览器内置识别（Web Speech API）。Edge 通常可用；Chrome 走 Google 服务，国内大概率报 network
 *   cloud   : 本地录音 → 后端 /api/asr 转写。需要 config.json 配好 ASR key
 *   mock    : 不碰麦克风，按剧本逐字吐 partial。断网演示的兜底
 */

const VAD = {
  frameMs: 40,
  speechOn: 0.028, // 起始能量阈值（归一化 RMS）
  speechOff: 0.014, // 维持阈值，低于此开始计静音
  minSpeechMs: 300,
  silenceEndMs: 1000, // 老人说话有停顿，1s 才判停
  maxUtteranceMs: 20000,
}

export class VoiceInput {
  constructor({ channel = 'browser', onEvent = () => {}, mockLines = [] }) {
    this.channel = channel
    this.onEvent = onEvent
    this.mockLines = mockLines
    this.state = 'idle' // idle | ready | speech | closed
    this._stopRequested = false
    this._mockTimer = null
  }

  emit(type, data = {}) {
    try {
      this.onEvent(type, data)
    } catch (e) {
      console.error('[voice] handler error', e)
    }
  }

  async start() {
    this._stopRequested = false
    this._aborted = false
    if (this.channel === 'mock') return this._startMock()
    if (this.channel === 'cloud') return this._startCloud()
    return this._startBrowser()
  }

  /** 用户主动结束当前这句话（空格再按一次） */
  stop() {
    this._stopRequested = true
    if (this.channel === 'browser') {
      try {
        this._rec && this._rec.stop()
      } catch {}
    } else if (this.channel === 'cloud') {
      this._finishCloud()
    } else {
      this._finishMock()
    }
  }

  /** 打断：立刻中断，不产生 final */
  abort() {
    this._stopRequested = true
    this._aborted = true
    clearInterval(this._mockTimer)
    clearTimeout(this._cloudTimer)
    try {
      this._rec && this._rec.abort && this._rec.abort()
      this._rec && this._rec.stop && this._rec.stop()
    } catch {}
    try {
      if (this._recorder && this._recorder.state !== 'inactive') this._recorder.stop()
    } catch {}
    try {
      this._stream && this._stream.getTracks().forEach((t) => t.stop())
    } catch {}
    try {
      if (this._audioCtx) this._audioCtx.close()
    } catch {}
    this.state = 'closed'
    this._discardCloud = true
    this.emit('end', { reason: 'abort' })
  }

  /* ------------------------------------------------------ 通道一：浏览器识别 */

  _startBrowser() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      this.emit('error', { code: 'UNSUPPORTED', message: '当前浏览器不支持语音识别，请换 Edge 或用云端通道' })
      return
    }

    const rec = new SR()
    rec.lang = 'zh-CN'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    let gotAny = false
    let finalText = ''
    let idleTimer = null

    // 浏览器识别本身没有 VAD，用"文字静默 1.2 秒"代替判停，说完自动结束
    const armAutoStop = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        try {
          rec.stop()
        } catch {}
      }, 1200)
    }

    rec.onstart = () => {
      this.state = 'ready'
      this.emit('ready', {})
    }

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      if (interim.trim() || finalText.trim()) {
        gotAny = true
        this.state = 'speech'
        this.emit('partial', { text: (finalText + interim).trim() })
        // 内置识别不提供能量值，用随机值伪造一个电平，让波形有反应
        this.emit('level', { value: Math.min(0.9, 0.35 + Math.random() * 0.5) })
        armAutoStop()
      }
    }

    rec.onerror = (e) => {
      const code = e.error || 'UNKNOWN'
      const map = {
        'not-allowed': '麦克风权限被拒绝，请点地址栏的图标允许麦克风',
        'service-not-allowed': '麦克风权限被拒绝',
        network: '浏览器识别服务连不上（Chrome 依赖 Google 服务），请改用云端通道或 Edge',
        'no-speech': '没有听到声音',
        'audio-capture': '找不到麦克风设备',
        aborted: '已取消',
      }
      // no-speech 是正常超时，不当中断处理
      if (code === 'no-speech' || code === 'aborted') {
        this.emit('end', { reason: code })
        return
      }
      this.emit('error', { code, message: map[code] || `识别出错：${code}` })
    }

    rec.onend = () => {
      clearTimeout(idleTimer)
      this.state = 'closed'
      if (this._aborted) {
        this._aborted = false
        this.emit('end', { reason: 'abort' })
        return
      }
      const text = finalText.trim()
      if (text && !this._stopRequested) {
        this.emit('final', { text, confidence: 0.9 })
      } else if (text) {
        this.emit('final', { text, confidence: 0.9 })
      } else if (!gotAny) {
        this.emit('end', { reason: 'empty' })
      } else {
        this.emit('end', { reason: 'done' })
      }
      this._rec = null
    }

    this._rec = rec
    try {
      rec.start()
    } catch (e) {
      this.emit('error', { code: 'START_FAILED', message: '启动识别失败：' + e.message })
    }
  }

  /* ------------------------------------------------------ 通道二：录音转写 */

  async _startCloud() {
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (e) {
      this.emit('error', { code: 'MIC_DENIED', message: '拿不到麦克风：' + e.message })
      return
    }

    this._stream = stream
    this._discardCloud = false

    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    this._audioCtx = ctx
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    src.connect(analyser)
    const buf = new Float32Array(analyser.fftSize)

    // 录音器：优先 opus/webm
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : ''
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    this._recorder = recorder
    const chunks = []
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    recorder.onstop = async () => {
      try {
        stream.getTracks().forEach((t) => t.stop())
        ctx.close()
      } catch {}
      if (this._discardCloud) return
      const blob = new Blob(chunks, { type: mime || 'audio/webm' })
      if (blob.size < 2000) {
        this.emit('end', { reason: 'empty' })
        return
      }
      this.emit('thinking', {})
      try {
        const ext = (mime || 'audio/webm').includes('webm') ? 'webm' : 'wav'
        const r = await fetch('/api/asr?ext=' + ext, {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
          body: blob,
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j.detail || j.error || 'ASR 失败')
        const text = (j.text || '').trim()
        if (text) this.emit('final', { text, confidence: 0.9 })
        else this.emit('end', { reason: 'empty' })
      } catch (e) {
        this.emit('error', { code: 'ASR_FAILED', message: '转写失败：' + e.message })
      }
    }

    recorder.start()
    this.state = 'ready'
    this.emit('ready', {})

    // 能量监测：驱动波形 + 自动判停
    const t0 = performance.now()
    let speechStarted = false
    let speechStartAt = 0
    let silenceSince = 0
    let lastSpeechAt = 0

    const tick = () => {
      if (!this._audioCtx || this._audioCtx.state === 'closed') return
      analyser.getFloatTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      const rms = Math.sqrt(sum / buf.length)
      const level = Math.min(1, rms * 12)
      this.emit('level', { value: level })

      const now = performance.now()
      if (rms > VAD.speechOn) {
        lastSpeechAt = now
        if (!speechStarted) {
          speechStarted = true
          speechStartAt = now
          this.state = 'speech'
          this.emit('speechstart', {})
        }
        silenceSince = 0
      } else if (speechStarted && rms < VAD.speechOff) {
        if (!silenceSince) silenceSince = now
        else if (now - silenceSince > VAD.silenceEndMs) {
          this._finishCloud()
          return
        }
      }

      // 超长强制收尾
      if (now - t0 > VAD.maxUtteranceMs) {
        this._finishCloud()
        return
      }
      // 一直没人说话：6 秒后收尾
      if (!speechStarted && now - t0 > 6000) {
        this._finishCloud()
        return
      }
      this._cloudTimer = requestAnimationFrame(tick)
    }
    this._cloudTimer = requestAnimationFrame(tick)
  }

  _finishCloud() {
    cancelAnimationFrame(this._cloudTimer)
    try {
      if (this._recorder && this._recorder.state === 'recording') this._recorder.stop()
    } catch {}
    this.state = 'closed'
  }

  /* ------------------------------------------------------ 通道三：Mock */

  _startMock() {
    this.state = 'ready'
    this.emit('ready', {})
    const line = this.mockLines[Math.floor(Math.random() * this.mockLines.length)] || '我这两天血压有点高'
    this._lastMockLine = line
    let i = 0
    this._mockTimer = setInterval(() => {
      i += 2
      this.emit('partial', { text: line.slice(0, i) })
      this.emit('level', { value: 0.4 + Math.random() * 0.5 })
      if (i >= line.length) this._finishMock()
    }, 110)
  }

  _finishMock() {
    clearInterval(this._mockTimer)
    const line = this._lastMockLine || '我这两天血压有点高'
    this.state = 'closed'
    setTimeout(() => this.emit('final', { text: line, confidence: 0.95 }), 120)
  }
}
