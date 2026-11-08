/**
 * 安安 v3 分层播放器（对齐 preview-v3.html / meta.json）
 *
 * - 眨眼：四档随机（快/普/慢/连眨）
 * - 抖耳：meta.earFlick.patterns 加权序列（预备→爆发→回弹→回落）
 * - 摆尾：rAF 双谐波 + 微震颤 + 偶发阻尼快摆（不用 CSS 完美正弦）
 * - 说话：三级开口 + 音节节奏（成串后停顿）
 *
 * 对外：setViseme / setEmotion / startSpeak / stopSpeak / destroy
 */

export class LayeredSpriteAvatar {
  constructor(host, options = {}) {
    this.host = host
    this.packId = options.packId || 'anan-cat-v3'
    this.baseUrl = options.baseUrl || `/sprites/${this.packId}`
    this.meta = null
    this.emotion = 'neutral'
    this.speaking = false
    this.viseme = 'sil'
    this._busy = false
    this._baseEl = null
    this._tailEl = null
    this._blinkTimer = null
    this._earTimer = null
    this._tailRaf = 0
    this._speakToken = 0
    this._earLevels = new Map()
    this._status = null
    this._ready = this._init()
  }

  async _init() {
    this.host.innerHTML = `
      <div class="layer-root" style="
        position:relative;width:100%;height:100%;
        display:flex;align-items:flex-end;justify-content:center;
      ">
        <div class="layer-stage" style="position:relative;width:100%;height:100%;max-width:560px;">
          <img class="L base" alt="安安" draggable="false"/>
          <img class="L shadow" alt="" draggable="false"/>
          <img class="L tail" alt="" draggable="false"/>
        </div>
        <div class="layer-loading" style="
          position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
          color:#b9c9c4;font-size:22px;
        ">安安加载中…</div>
      </div>
      <style>
        .layer-stage .L {
          position:absolute; inset:0;
          width:100%; height:100%;
          object-fit:contain; object-position:center bottom;
          pointer-events:none; user-select:none;
        }
        .layer-stage .base {
          filter: drop-shadow(0 18px 22px rgba(0,0,0,.28));
        }
        .layer-stage .tail {
          transform-origin: 81.02% 89.41%;
          will-change: transform;
        }
      </style>
    `

    this._baseEl = this.host.querySelector('.layer-stage .base')
    this._shadowEl = this.host.querySelector('.layer-stage .shadow')
    this._tailEl = this.host.querySelector('.layer-stage .tail')
    this._status = this.host.querySelector('.layer-loading')

    try {
      this.meta = await (await fetch(`${this.baseUrl}/meta.json`)).json()
    } catch (e) {
      console.error('[layered-v3] meta 失败', e)
      if (this._status) this._status.textContent = '素材加载失败'
      return
    }

    const pivot = this.meta.tail?.pivot || this.meta.layers?.tailPivot || '81.02% 89.41%'
    if (this._tailEl) this._tailEl.style.transformOrigin = pivot

    // 耳朵档位 key -> 文件
    ;(this.meta.earFlick?.levels || []).forEach((lv) => {
      this._earLevels.set(lv.key, lv.file)
    })

    const preload = new Set([
      'layers/base-body-idle.webp',
      'layers/base-body-blink.webp',
      'layers/base-body-listen.webp',
      'layers/base-body-alert.webp',
      'layers/base-body-happy.webp',
      'layers/base-mouth-1.webp',
      'layers/base-mouth-2.webp',
      'layers/base-mouth-3.webp',
      'layers/part-tail.webp',
      'layers/tail-shadow.webp',
    ])
    ;(this.meta.earFlick?.levels || []).forEach((lv) => preload.add(lv.file))

    await Promise.all(
      [...preload].map(
        (f) =>
          new Promise((resolve) => {
            const im = new Image()
            im.onload = resolve
            im.onerror = resolve
            im.src = this._url(f)
          })
      )
    )

    this._shadowEl.src = this._url(this.meta.tail?.shadow || 'layers/tail-shadow.webp')
    this._tailEl.src = this._url(this.meta.tail?.layer || 'layers/part-tail.webp')
    this._setBase('layers/base-body-idle.webp')

    if (this._status) this._status.style.display = 'none'
    this._startTail()
    this._scheduleBlink()
    this._scheduleEar()
  }

  _url(rel) {
    return `${this.baseUrl}/${rel}`
  }

  _idleBase() {
    return 'layers/base-body-idle.webp'
  }

  _setBase(rel) {
    if (!this._baseEl) return
    this._baseEl.src = this._url(rel)
  }

  _poseBase() {
    if (this.speaking) {
      // 说话过程中由音节逻辑直接换嘴；这里给兜底闭嘴
      return this._idleBase()
    }
    if (this.emotion === 'listen') return 'layers/base-body-listen.webp'
    if (this.emotion === 'alert') return 'layers/base-body-alert.webp'
    if (this.emotion === 'smile' || this.emotion === 'happy') return 'layers/base-body-happy.webp'
    return this._idleBase()
  }

  _restorePose() {
    this._setBase(this._poseBase())
  }

  _canMicroMotion() {
    return !this.speaking && this.emotion === 'neutral' && !this._busy
  }

  /* ---------------- 尾巴 rAF ---------------- */

  _startTail() {
    const el = this._tailEl
    if (!el) return
    const wave = this.meta?.tail?.wave || {}
    const flickCfg = this.meta?.tail?.flick || {}
    const h1 = wave.harmonic1 || { ampDeg: 3, periodMs: [6400, 8200] }
    const h2 = wave.harmonic2 || { ampDeg: 1.05, periodMs: [2700, 3500] }
    const tremor = wave.tremor || { ampDeg: 0.32, periodMs: 830 }

    const T1 = ((h1.periodMs?.[0] || 6400) + Math.random() * ((h1.periodMs?.[1] || 8200) - (h1.periodMs?.[0] || 6400))) / 1000
    const T2 = ((h2.periodMs?.[0] || 2700) + Math.random() * ((h2.periodMs?.[1] || 3500) - (h2.periodMs?.[0] || 2700))) / 1000
    const Ttrem = (tremor.periodMs || 830) / 1000
    const phase = Math.random() * 10
    let flick = null
    let nextFlick =
      performance.now() + (flickCfg.minGapMs || 3500) + Math.random() * ((flickCfg.maxGapMs || 12500) - (flickCfg.minGapMs || 3500))

    const damping = flickCfg.damping ?? 3.4
    const omega = flickCfg.omega ?? 11.5
    const ampRange = flickCfg.ampDeg || [4.5, 7.5]

    const frame = (now) => {
      const t = now / 1000 + phase
      let a =
        (h1.ampDeg ?? 3) * Math.sin((2 * Math.PI * t) / T1) +
        (h2.ampDeg ?? 1.05) * Math.sin((2 * Math.PI * t) / T2 + 1.35) +
        (tremor.ampDeg ?? 0.32) * Math.sin((2 * Math.PI * t) / Ttrem + Math.sin(t * 0.41) * 1.7)

      if (now > nextFlick) {
        const amp = (Math.random() < 0.5 ? 1 : -1) * (ampRange[0] + Math.random() * (ampRange[1] - ampRange[0]))
        flick = { t0: now, amp }
        nextFlick =
          now + (flickCfg.minGapMs || 3500) + Math.random() * ((flickCfg.maxGapMs || 12500) - (flickCfg.minGapMs || 3500))
      }
      if (flick) {
        const dt = (now - flick.t0) / 1000
        if (dt > 1.7) flick = null
        else a += flick.amp * Math.exp(-damping * dt) * Math.sin(omega * dt)
      }
      el.style.transform = `rotate(${a.toFixed(3)}deg)`
      this._tailRaf = requestAnimationFrame(frame)
    }
    this._tailRaf = requestAnimationFrame(frame)
  }

  /* ---------------- 眨眼 ---------------- */

  _pickBlink() {
    const variants = this.meta?.blink?.variants
    if (!variants) return { durationMs: 160, gapMs: 0 }
    const pool = []
    Object.values(variants).forEach((v) => {
      const w = v.weight || 1
      for (let i = 0; i < w; i++) pool.push(v)
    })
    return pool[Math.floor(Math.random() * pool.length)] || { durationMs: 160 }
  }

  _scheduleBlink() {
    this._clearBlink()
    const min = this.meta?.blink?.minGapMs ?? 3200
    const max = this.meta?.blink?.maxGapMs ?? 6800
    this._blinkTimer = setTimeout(() => this._doBlink(), min + Math.random() * (max - min))
  }

  _doBlink() {
    if (!this._canMicroMotion()) {
      this._scheduleBlink()
      return
    }
    const b = this._pickBlink()
    const dur = b.durationMs ?? 160
    const gap = b.gapMs ?? 0
    this._busy = true
    this._setBase('layers/base-body-blink.webp')

    const finish = () => {
      this._busy = false
      if (!this.speaking && this.emotion === 'neutral') this._restorePose()
      this._scheduleBlink()
    }

    setTimeout(() => {
      this._setBase(this._idleBase())
      if (!gap) {
        finish()
        return
      }
      setTimeout(() => {
        this._setBase('layers/base-body-blink.webp')
        setTimeout(() => {
          this._setBase(this._idleBase())
          finish()
        }, dur)
      }, gap)
    }, dur)
  }

  /* ---------------- 抖耳 ---------------- */

  _pickEarPattern() {
    const patterns = this.meta?.earFlick?.patterns || []
    if (!patterns.length) return null
    const pool = []
    patterns.forEach((p) => {
      const w = p.weight || 1
      for (let i = 0; i < w; i++) pool.push(p)
    })
    return pool[Math.floor(Math.random() * pool.length)]
  }

  _scheduleEar() {
    this._clearEar()
    const min = this.meta?.earFlick?.minGapMs ?? 4200
    const max = this.meta?.earFlick?.maxGapMs ?? 9800
    this._earTimer = setTimeout(() => this._doEar(), min + Math.random() * (max - min))
  }

  _doEar() {
    if (!this._canMicroMotion()) {
      this._scheduleEar()
      return
    }
    const pat = this._pickEarPattern()
    if (!pat) {
      this._scheduleEar()
      return
    }
    this._busy = true
    const seq = pat.sequence || []
    const steps = pat.stepMs || []
    let t = 0
    seq.forEach((key, i) => {
      const ms = steps[i] ?? 60
      const file = key === 'idle' ? this._idleBase() : this._earLevels.get(key)
      setTimeout(() => {
        if (file) this._setBase(file)
      }, t)
      t += ms
    })
    setTimeout(() => {
      this._busy = false
      if (!this.speaking && this.emotion === 'neutral') this._restorePose()
      this._scheduleEar()
    }, t)
  }

  /* ---------------- 说话（音节节奏） ---------------- */

  _mouthFile(level) {
    // 0=闭嘴 idle；1/2/3=开口档
    if (!level) return this._idleBase()
    return `layers/base-mouth-${level}.webp`
  }

  _syllable() {
    return new Promise((resolve) => {
      if (!this.speaking) {
        resolve()
        return
      }
      const open = 1 + Math.floor(Math.random() * 3)
      const hold = 70 + Math.random() * 90
      this._setBase(this._mouthFile(open))
      setTimeout(() => {
        if (!this.speaking) {
          resolve()
          return
        }
        if (Math.random() < 0.5) {
          this._setBase(this._idleBase())
          setTimeout(resolve, 45 + Math.random() * 70)
        } else {
          resolve()
        }
      }, hold)
    })
  }

  async _speakLoop(token) {
    while (this.speaking && token === this._speakToken) {
      const n = 4 + Math.floor(Math.random() * 6)
      for (let i = 0; i < n && this.speaking && token === this._speakToken; i++) {
        await this._syllable()
      }
      if (!this.speaking || token !== this._speakToken) break
      this._setBase(this._idleBase())
      await new Promise((r) => setTimeout(r, 220 + Math.random() * 420))
    }
  }

  /* ---------------- 对外 API ---------------- */

  setViseme(name) {
    // 分层版说话走音节节奏；保留接口兼容，不强制切帧
    this.viseme = name || 'sil'
  }

  setEmotion(name) {
    this.emotion = name || 'neutral'
    if (this.speaking) return
    this._busy = false
    this._restorePose()
  }

  startSpeak() {
    this.speaking = true
    this._busy = false
    this._speakToken += 1
    const token = this._speakToken
    this._speakLoop(token)
  }

  stopSpeak() {
    this.speaking = false
    this._speakToken += 1
    if (this.emotion === 'smile') this.emotion = 'neutral'
    this._restorePose()
  }

  setKind() {}

  _clearBlink() {
    if (this._blinkTimer) clearTimeout(this._blinkTimer)
    this._blinkTimer = null
  }

  _clearEar() {
    if (this._earTimer) clearTimeout(this._earTimer)
    this._earTimer = null
  }

  destroy() {
    this.speaking = false
    this._speakToken += 1
    this._clearBlink()
    this._clearEar()
    cancelAnimationFrame(this._tailRaf)
    if (this.host) this.host.innerHTML = ''
  }
}
