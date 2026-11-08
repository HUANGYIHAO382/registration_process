/**
 * 精灵图集播放器（真正的帧动画）
 *
 * 用一张 spritesheet + background-position 播行动画，
 * idle 是连续帧循环，不会再出现「两张立绘硬切」的不自然感。
 *
 * 对外接口与 SpriteAvatar / SVG Avatar 对齐：
 * setViseme / setEmotion / startSpeak / stopSpeak / destroy
 */

export class SheetAvatar {
  constructor(host, options = {}) {
    this.host = host
    this.packId = options.packId || 'maodie-sheet'
    this.baseUrl = options.baseUrl || `/sprites/${this.packId}`
    this.meta = null
    this.emotion = 'neutral'
    this.speaking = false
    this.viseme = 'sil'
    this._animName = 'idle'
    this._frame = 0
    this._acc = 0
    this._lastTs = 0
    this._raf = 0
    this._el = null
    this._status = null
    this._ready = this._init()
  }

  async _init() {
    this.host.innerHTML = `
      <div class="sheet-root" style="
        position:relative;width:100%;height:100%;
        display:flex;align-items:flex-end;justify-content:center;
      ">
        <div class="sheet-bob" style="
          width:min(100%, 520px); aspect-ratio:192/208;
          transform-origin:50% 90%;
          will-change:transform;
        ">
          <div class="sheet-sprite" role="img" aria-label="安安" style="
            width:100%;height:100%;
            background-repeat:no-repeat;
            image-rendering:auto;
            filter: drop-shadow(0 18px 28px rgba(0,0,0,0.3));
          "></div>
        </div>
        <div class="sheet-loading" style="
          position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
          color:#b9c9c4;font-size:22px;
        ">图集加载中…</div>
      </div>
      <style>
        @keyframes sheet-breathe {
          0%,100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.015); }
        }
        .sheet-bob.is-live { animation: sheet-breathe 3.2s ease-in-out infinite; }
      </style>
    `

    this._bob = this.host.querySelector('.sheet-bob')
    this._el = this.host.querySelector('.sheet-sprite')
    this._status = this.host.querySelector('.sheet-loading')

    try {
      this.meta = await (await fetch(`${this.baseUrl}/meta.json`)).json()
    } catch (e) {
      console.error('[sheet] meta 失败', e)
      if (this._status) this._status.textContent = '图集加载失败'
      return
    }

    const sheetFile = this.meta.sheet.file
    const url = `${this.baseUrl}/${sheetFile}`

    // 预加载图集
    await new Promise((resolve) => {
      const im = new Image()
      im.onload = resolve
      im.onerror = resolve
      im.src = url
    })

    const { cols, rows, frameW, frameH } = this.meta.sheet
    // 用百分比定位：background-size = 整张表相对单帧的倍数
    this._el.style.backgroundImage = `url(${url})`
    this._el.style.backgroundSize = `${cols * 100}% ${rows * 100}%`
    this._frameW = frameW
    this._frameH = frameH
    this._cols = cols
    this._rows = rows

    if (this._status) this._status.style.display = 'none'
    this._bob.classList.add('is-live')
    this._setAnim('idle')
    this._lastTs = performance.now()
    this._raf = requestAnimationFrame((t) => this._tick(t))
  }

  _setAnim(name) {
    const anim = this.meta?.anims?.[name] || this.meta?.anims?.idle
    if (!anim) return
    if (this._animName === name) return
    this._animName = name
    this._frame = 0
    this._acc = 0
    this._paint()
  }

  _paint() {
    if (!this._el || !this.meta) return
    const anim = this.meta.anims[this._animName] || this.meta.anims.idle
    const col = this._frame % (anim.frames || this._cols)
    const row = anim.row
    // background-position 百分比公式：
    // x% = col / (cols-1) * 100；y% = row / (rows-1) * 100
    const x = this._cols <= 1 ? 0 : (col / (this._cols - 1)) * 100
    const y = this._rows <= 1 ? 0 : (row / (this._rows - 1)) * 100
    this._el.style.backgroundPosition = `${x}% ${y}%`
  }

  _tick(ts) {
    const anim = this.meta?.anims?.[this._animName]
    if (anim) {
      const dt = ts - this._lastTs
      this._lastTs = ts
      const frameMs = 1000 / (anim.fps || 8)
      this._acc += dt
      while (this._acc >= frameMs) {
        this._acc -= frameMs
        const n = anim.frames || this._cols
        this._frame = (this._frame + 1) % n
        this._paint()
      }
    }
    this._raf = requestAnimationFrame((t) => this._tick(t))
  }

  /** 口型：图集方案用说话行动画代替单嘴型；保留接口兼容 */
  setViseme(name) {
    this.viseme = name || 'sil'
  }

  setEmotion(name) {
    this.emotion = name || 'neutral'
    if (this.speaking) return
    if (name === 'listen') this._setAnim('listen')
    else if (name === 'alert') this._setAnim('alert')
    else if (name === 'concern') this._setAnim('think')
    else this._setAnim('idle')
  }

  startSpeak() {
    this.speaking = true
    this._setAnim('speak')
  }

  stopSpeak() {
    this.speaking = false
    if (this.emotion === 'listen') this._setAnim('listen')
    else if (this.emotion === 'alert') this._setAnim('alert')
    else this._setAnim('idle')
  }

  setKind() {}

  destroy() {
    cancelAnimationFrame(this._raf)
    if (this.host) this.host.innerHTML = ''
  }
}
