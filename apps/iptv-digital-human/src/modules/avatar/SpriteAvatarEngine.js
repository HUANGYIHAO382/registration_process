/**
 * 高清单立绘播放器（透明 PNG）
 *
 * 待机：只用 1 张底图 + CSS 呼吸/轻晃，不再在多张 AI 立绘之间切换
 * （多张生成图构图不一致，硬切/淡入都会「跳」，这是之前不自然的主因）
 *
 * 说话：在同一构图的嘴型帧之间做短交叉淡入
 */

const SPEAK_SEQ = ['sil', 'a', 'o', 'a', 'm', 'sil', 'o', 'a', 'm']

export class SpriteAvatar {
  constructor(host, options = {}) {
    this.host = host
    this.packId = options.packId || 'anan-hd-cat'
    this.baseUrl = options.baseUrl || `/sprites/${this.packId}`
    this.meta = null
    this.emotion = 'neutral'
    this.speaking = false
    this.viseme = 'sil'
    this._seqIdx = 0
    this._speakTimer = null
    this._fadeTimer = null
    this._front = 0
    this._layers = []
    this._bob = null
    this._status = null
    this._currentFile = null
    this._ready = this._init()
  }

  async _init() {
    this.host.innerHTML = `
      <div class="sprite-root" style="
        position:relative;width:100%;height:100%;
        display:flex;align-items:flex-end;justify-content:center;
      ">
        <div class="sprite-bob" style="
          position:relative;width:100%;height:100%;
          transform-origin:50% 90%;
          will-change:transform;
        ">
          <div class="sprite-stage" style="position:relative;width:100%;height:100%;">
            <img class="sprite-layer L0" alt="" draggable="false"/>
            <img class="sprite-layer L1" alt="" draggable="false"/>
          </div>
        </div>
        <div class="sprite-loading" style="
          position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
          color:#b9c9c4;font-size:22px;
        ">形象加载中…</div>
      </div>
      <style>
        .sprite-layer {
          position:absolute; inset:0;
          width:100%; height:100%;
          object-fit:contain; object-position:center bottom;
          user-select:none; pointer-events:none;
          opacity:0;
          filter: drop-shadow(0 22px 28px rgba(0,0,0,0.28));
          transition: opacity 0.22s ease-in-out;
        }
        .sprite-layer.is-show { opacity: 1; }
        @keyframes sprite-breathe {
          0%, 100% { transform: translateY(0) rotate(-0.35deg) scale(1); }
          50% { transform: translateY(-12px) rotate(0.4deg) scale(1.016); }
        }
        @keyframes sprite-speak-bob {
          0%, 100% { transform: translateY(0) rotate(-0.5deg) scale(1.01); }
          50% { transform: translateY(-7px) rotate(0.55deg) scale(1.02); }
        }
        .sprite-bob.is-idle { animation: sprite-breathe 3.8s ease-in-out infinite; }
        .sprite-bob.is-speak { animation: sprite-speak-bob 0.9s ease-in-out infinite; }
        .sprite-bob.is-listen { animation: sprite-breathe 2.6s ease-in-out infinite; }
      </style>
    `

    this._bob = this.host.querySelector('.sprite-bob')
    this._layers = [
      this.host.querySelector('.sprite-layer.L0'),
      this.host.querySelector('.sprite-layer.L1'),
    ]
    this._status = this.host.querySelector('.sprite-loading')

    try {
      this.meta = await (await fetch(`${this.baseUrl}/meta.json`)).json()
    } catch (e) {
      console.error('[sprite] meta 失败', e)
      if (this._status) this._status.textContent = '精灵图加载失败'
      return
    }

    const files = new Set()
    // 待机只预加载第 1 张（主底图）
    if (this.meta.frames.idle?.[0]) files.add(this.meta.frames.idle[0])
    ;(this.meta.frames.listen || []).forEach((f) => files.add(f))
    ;(this.meta.frames.alert || []).forEach((f) => files.add(f))
    Object.values(this.meta.frames.mouth || {}).forEach((f) => files.add(f))

    await Promise.all(
      [...files].map(
        (f) =>
          new Promise((resolve) => {
            const im = new Image()
            im.onload = resolve
            im.onerror = resolve
            im.src = `${this.baseUrl}/${f}`
          })
      )
    )

    if (this._status) this._status.style.display = 'none'
    this._setBobClass('idle')
    await this._crossfadeTo(this._idleFile())
  }

  _idleFile() {
    // 关键：待机永远同一张，动作交给 CSS
    return this.meta?.frames?.idle?.[0] || null
  }

  _resolveFile() {
    const f = this.meta?.frames
    if (!f) return null
    if (this.emotion === 'alert') return f.alert?.[0] || this._idleFile()
    if (this.speaking) {
      const mouth = f.mouth || {}
      return mouth[this.viseme] || mouth.sil || this._idleFile()
    }
    if (this.emotion === 'listen') return f.listen?.[0] || this._idleFile()
    return this._idleFile()
  }

  _setBobClass(mode) {
    if (!this._bob) return
    this._bob.classList.remove('is-idle', 'is-speak', 'is-listen')
    if (mode === 'speak') this._bob.classList.add('is-speak')
    else if (mode === 'listen') this._bob.classList.add('is-listen')
    else this._bob.classList.add('is-idle')
  }

  _crossfadeTo(file) {
    if (!file || !this._layers.length) return Promise.resolve()
    if (file === this._currentFile) return Promise.resolve()
    const url = `${this.baseUrl}/${file}`
    const nextIdx = 1 - this._front
    const next = this._layers[nextIdx]
    const cur = this._layers[this._front]

    return new Promise((resolve) => {
      const finish = () => {
        this._front = nextIdx
        this._currentFile = file
        resolve()
      }
      const onReady = () => {
        next.classList.add('is-show')
        cur.classList.remove('is-show')
        clearTimeout(this._fadeTimer)
        this._fadeTimer = setTimeout(finish, 240)
      }
      if (next.dataset.src === url && next.complete) {
        onReady()
        return
      }
      next.onload = onReady
      next.onerror = finish
      next.dataset.src = url
      next.src = url
      if (next.complete && next.naturalWidth) onReady()
    })
  }

  _show() {
    return this._crossfadeTo(this._resolveFile())
  }

  setViseme(name) {
    this.viseme = name || 'sil'
    if (this.speaking) this._show()
  }

  setEmotion(name) {
    this.emotion = name || 'neutral'
    if (this.speaking) return
    if (name === 'listen') this._setBobClass('listen')
    else this._setBobClass('idle')
    this._show()
  }

  startSpeak() {
    this.speaking = true
    this.emotion = 'smile'
    this._setBobClass('speak')
    this._clearSpeak()
    const ms = this.meta?.speakIntervalMs || 180
    this._speakTimer = setInterval(() => {
      this.viseme = SPEAK_SEQ[this._seqIdx % SPEAK_SEQ.length]
      this._seqIdx++
      this._show()
    }, ms)
  }

  stopSpeak() {
    this.speaking = false
    this._clearSpeak()
    this.viseme = 'sil'
    if (this.emotion === 'smile') this.emotion = 'neutral'
    this._setBobClass('idle')
    this._show()
  }

  _clearSpeak() {
    if (this._speakTimer) {
      clearInterval(this._speakTimer)
      this._speakTimer = null
    }
  }

  setKind() {}

  destroy() {
    this._clearSpeak()
    clearTimeout(this._fadeTimer)
    if (this.host) this.host.innerHTML = ''
  }
}
