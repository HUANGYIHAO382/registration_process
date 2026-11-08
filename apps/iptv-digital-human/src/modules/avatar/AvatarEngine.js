/**
 * Avatar —— 卡通吉祥物（纯 SVG）
 *
 * 默认：cat「安安」圆滚小猫 + 青绿围巾
 * 可选：dog「旺旺」圆头小狗 + 同款围巾
 *
 * 对外接口不变：setViseme / setEmotion / startSpeak / stopSpeak
 * 嘴型、眨眼仍靠 #mouth / #eyeL / #eyeR 等节点
 */

const VISEME = {
  // 卡通嘴：比真人略夸张，电视大屏更明显
  sil: { rx: 18, ry: 2, op: 0 },
  m: { rx: 16, ry: 3, op: 0 },
  a: { rx: 26, ry: 22, op: 1 },
  e: { rx: 28, ry: 14, op: 1 },
  i: { rx: 32, ry: 8, op: 1 },
  o: { rx: 18, ry: 20, op: 1 },
  u: { rx: 12, ry: 14, op: 1 },
  smile: { rx: 24, ry: 8, op: 0 },
}

const SPEAK_SEQ = ['a', 'e', 'o', 'i', 'm', 'a', 'u', 'e', 'm', 'o', 'i', 'a', 'e', 'm']

export class Avatar {
  constructor(host, kind = 'cat') {
    this.host = host
    this.kind = kind === 'dog' ? 'dog' : 'cat'
    this.viseme = 'sil'
    this.target = { ...VISEME.sil }
    this.cur = { ...VISEME.sil }
    this.emotion = 'neutral'
    this.speaking = false
    this._raf = null
    this._seqIdx = 0
    this._seqClock = 0
    this._blinkAt = performance.now() + 2000
    this._t0 = performance.now()

    host.innerHTML = this._template(this.kind)
    this._cache()
    this._loop()
  }

  _template(kind) {
    const isCat = kind !== 'dog'
    // 猫：暖橘；狗：暖米棕
    const fur = isCat ? '#F4A261' : '#E8C39E'
    const furDark = isCat ? '#E0762F' : '#C9956A'
    const furLight = isCat ? '#FFD7A8' : '#F3E0C8'
    const nose = isCat ? '#E86A6A' : '#5C4033'
    const scarf = '#12B39B'
    const scarfDark = '#0E8C7A'

    // 耳朵：猫尖耳 / 狗垂耳
    const ears = isCat
      ? `
        <g id="earL">
          <path d="M120 210 L155 70 L230 175 Z" fill="${fur}"/>
          <path d="M145 195 L165 105 L215 170 Z" fill="#FFB4C0" opacity="0.85"/>
        </g>
        <g id="earR">
          <path d="M400 210 L365 70 L290 175 Z" fill="${fur}"/>
          <path d="M375 195 L355 105 L305 170 Z" fill="#FFB4C0" opacity="0.85"/>
        </g>
      `
      : `
        <g id="earL">
          <ellipse cx="118" cy="250" rx="48" ry="78" fill="${furDark}" transform="rotate(-18 118 250)"/>
          <ellipse cx="118" cy="255" rx="28" ry="52" fill="#F6D5B8" transform="rotate(-18 118 255)" opacity="0.9"/>
        </g>
        <g id="earR">
          <ellipse cx="402" cy="250" rx="48" ry="78" fill="${furDark}" transform="rotate(18 402 250)"/>
          <ellipse cx="402" cy="255" rx="28" ry="52" fill="#F6D5B8" transform="rotate(18 402 255)" opacity="0.9"/>
        </g>
      `

    // 身体：圆滚坐姿 + 围巾 + 小工牌
    const body = `
      <!-- 身子 -->
      <ellipse cx="260" cy="620" rx="168" ry="150" fill="${fur}"/>
      <ellipse cx="260" cy="640" rx="110" ry="95" fill="${furLight}" opacity="0.55"/>
      <!-- 前爪 -->
      <ellipse cx="190" cy="730" rx="48" ry="38" fill="${furDark}"/>
      <ellipse cx="330" cy="730" rx="48" ry="38" fill="${furDark}"/>
      <ellipse cx="190" cy="735" rx="28" ry="18" fill="${furLight}" opacity="0.5"/>
      <ellipse cx="330" cy="735" rx="28" ry="18" fill="${furLight}" opacity="0.5"/>
      <!-- 尾巴轻摇（静态弯） -->
      <path d="M400 560 C470 520 490 600 450 680 C430 720 410 700 420 660"
        fill="none" stroke="${furDark}" stroke-width="36" stroke-linecap="round"/>
      <path d="M400 560 C470 520 490 600 450 680 C430 720 410 700 420 660"
        fill="none" stroke="${fur}" stroke-width="22" stroke-linecap="round"/>
      <!-- 围巾 -->
      <path d="M120 470 C160 430 220 410 260 410 C300 410 360 430 400 470
        L390 520 C340 485 180 485 130 520 Z" fill="${scarf}"/>
      <path d="M300 500 L360 620 L320 630 L280 530 Z" fill="${scarfDark}"/>
      <path d="M300 500 L250 620 L290 635 L330 530 Z" fill="${scarf}"/>
      <!-- 工牌 -->
      <rect x="210" y="500" width="100" height="46" rx="10" fill="#F7FFFC" stroke="${scarfDark}" stroke-width="3"/>
      <text x="260" y="531" text-anchor="middle" font-size="22" font-weight="700"
        font-family="Microsoft YaHei, PingFang SC, sans-serif" fill="${scarfDark}">导诊</text>
    `

    // 猫胡须 / 狗没有
    const whiskers = isCat
      ? `
        <g stroke="#5C4033" stroke-width="3" stroke-linecap="round" opacity="0.55">
          <path d="M90 320 L170 330"/>
          <path d="M85 350 L168 348"/>
          <path d="M95 380 L172 365"/>
          <path d="M430 320 L350 330"/>
          <path d="M435 350 L352 348"/>
          <path d="M425 380 L348 365"/>
        </g>
      `
      : ''

    // 额头花纹：猫 M 纹 / 狗斑块
    const forehead = isCat
      ? `<path d="M230 200 C245 160 275 160 290 200 C270 185 250 185 230 200 Z" fill="${furDark}" opacity="0.55"/>`
      : `<ellipse cx="260" cy="210" rx="36" ry="22" fill="${furDark}" opacity="0.35"/>`

    return `
<svg viewBox="0 0 520 880" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="halo" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#12B39B" stop-opacity="0.28"/>
      <stop offset="55%" stop-color="#12B39B" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#12B39B" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fadeGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="82%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <mask id="bottomFade" maskUnits="userSpaceOnUse" x="0" y="0" width="520" height="880">
      <rect x="0" y="0" width="520" height="880" fill="url(#fadeGrad)"/>
    </mask>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>

  <ellipse cx="260" cy="340" rx="290" ry="300" fill="url(#halo)"/>
  <ellipse cx="260" cy="820" rx="170" ry="28" fill="#000" opacity="0.28" filter="url(#soft)"/>

  <g id="figure" mask="url(#bottomFade)">
    ${body}

    <g id="head">
      ${ears}
      <!-- 脑袋大圆 -->
      <ellipse cx="260" cy="300" rx="168" ry="160" fill="${fur}"/>
      <ellipse cx="260" cy="330" rx="120" ry="100" fill="${furLight}" opacity="0.35"/>
      ${forehead}

      <!-- 眉（用于情绪位移） -->
      <g id="browL" stroke="${furDark}" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.7">
        <path d="M175 248 q28 -14 52 2"/>
      </g>
      <g id="browR" stroke="${furDark}" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.7">
        <path d="M293 250 q28 -14 52 -2"/>
      </g>

      <!-- 大眼睛：卡通感 -->
      <g id="eyes">
        <g id="eyeL">
          <ellipse cx="195" cy="300" rx="36" ry="40" fill="#FFFFFF"/>
          <circle cx="200" cy="308" r="22" fill="#2C3A34"/>
          <circle cx="208" cy="298" r="8" fill="#FFFFFF" opacity="0.95"/>
          <circle cx="190" cy="318" r="4" fill="#FFFFFF" opacity="0.55"/>
        </g>
        <g id="eyeR">
          <ellipse cx="325" cy="300" rx="36" ry="40" fill="#FFFFFF"/>
          <circle cx="330" cy="308" r="22" fill="#2C3A34"/>
          <circle cx="338" cy="298" r="8" fill="#FFFFFF" opacity="0.95"/>
          <circle cx="320" cy="318" r="4" fill="#FFFFFF" opacity="0.55"/>
        </g>
      </g>

      <!-- 鼻子 -->
      <path d="M248 348 L260 362 L272 348 Z" fill="${nose}"/>
      <ellipse cx="260" cy="348" rx="10" ry="7" fill="${nose}"/>

      <!-- 嘴：ellipse 张口 + path 微笑 -->
      <ellipse id="mouth" cx="260" cy="395" rx="18" ry="2" fill="#7A3B36"/>
      <path id="mouthLine" d="M230 388 q30 28 60 0" stroke="#7A3B36" stroke-width="5" fill="none" stroke-linecap="round" opacity="1"/>
      <path id="mouthSmile" d="M220 385 q40 36 80 0" stroke="#7A3B36" stroke-width="5" fill="none" stroke-linecap="round" opacity="0"/>

      ${whiskers}

      <!-- 腮红 -->
      <ellipse cx="130" cy="350" rx="28" ry="16" fill="#E8836F" opacity="0.28"/>
      <ellipse cx="390" cy="350" rx="28" ry="16" fill="#E8836F" opacity="0.28"/>
    </g>
  </g>
</svg>`
  }

  _cache() {
    const q = (s) => this.host.querySelector(s)
    this.el = {
      figure: q('#figure'),
      head: q('#head'),
      eyeL: q('#eyeL'),
      eyeR: q('#eyeR'),
      browL: q('#browL'),
      browR: q('#browR'),
      mouth: q('#mouth'),
      mouthLine: q('#mouthLine'),
      mouthSmile: q('#mouthSmile'),
    }
  }

  setKind(kind) {
    const next = kind === 'dog' ? 'dog' : 'cat'
    if (next === this.kind) return
    this.kind = next
    this.host.innerHTML = this._template(next)
    this._cache()
  }

  setViseme(name) {
    const v = VISEME[name] || VISEME.sil
    this.viseme = name
    this.target = v
  }

  setEmotion(name) {
    this.emotion = name
    const e = this.el
    if (!e.browL) return
    const cfg = {
      neutral: { browY: 0, browRot: 0, eyeRy: 1 },
      smile: { browY: -4, browRot: 0, eyeRy: 0.85 },
      concern: { browY: 4, browRot: 8, eyeRy: 1.05 },
      listen: { browY: -6, browRot: 0, eyeRy: 1.12 },
      alert: { browY: 6, browRot: -10, eyeRy: 1.15 },
    }[name] || { browY: 0, browRot: 0, eyeRy: 1 }

    e.browL.setAttribute('transform', `translate(0 ${cfg.browY}) rotate(${-cfg.browRot} 200 248)`)
    e.browR.setAttribute('transform', `translate(0 ${cfg.browY}) rotate(${cfg.browRot} 320 248)`)
    e.eyeL.style.transformBox = 'fill-box'
    e.eyeR.style.transformBox = 'fill-box'
    e.eyeL.style.transformOrigin = 'center'
    e.eyeR.style.transformOrigin = 'center'
    e.eyeL.style.transform = `scaleY(${cfg.eyeRy})`
    e.eyeR.style.transform = `scaleY(${cfg.eyeRy})`
  }

  startSpeak() {
    this.speaking = true
    this._seqIdx = 0
    this._seqClock = 0
    this.setEmotion('smile')
  }

  stopSpeak() {
    this.speaking = false
    this.setViseme('sil')
    this.setEmotion('neutral')
  }

  _loop() {
    const step = () => {
      const now = performance.now()
      const dt = now - this._t0

      if (this.speaking) {
        this._seqClock += 16
        if (this._seqClock > 105) {
          this._seqClock = 0
          const next = SPEAK_SEQ[this._seqIdx % SPEAK_SEQ.length]
          this._seqIdx++
          this.setViseme(next)
        }
      }

      const k = 0.32
      this.cur.rx += (this.target.rx - this.cur.rx) * k
      this.cur.ry += (this.target.ry - this.cur.ry) * k
      this.cur.op += (this.target.op - this.cur.op) * k

      const open = this.cur.ry > 4
      this.el.mouth.setAttribute('rx', this.cur.rx.toFixed(2))
      this.el.mouth.setAttribute('ry', this.cur.ry.toFixed(2))
      this.el.mouth.setAttribute('opacity', this.cur.op.toFixed(2))
      const smiling = this.emotion === 'smile' || this.emotion === 'listen'
      this.el.mouthSmile.setAttribute('opacity', !open && smiling ? '1' : '0')
      this.el.mouthLine.setAttribute('opacity', !open && !smiling ? '1' : '0')

      // 呼吸轻晃 + 说话时更活泼
      const breathe = Math.sin(dt / 1400) * 4
      const bob = this.speaking ? Math.sin(dt / 150) * 3.2 : Math.sin(dt / 900) * 1.2
      this.el.figure.setAttribute(
        'transform',
        `translate(0 ${(breathe + bob).toFixed(2)}) rotate(${(this.speaking ? Math.sin(dt / 380) * 0.8 : Math.sin(dt / 2000) * 0.3).toFixed(2)} 260 700)`
      )

      if (now > this._blinkAt) {
        this._blinkAt = now + 2200 + Math.random() * 2400
        this.el.eyeL.style.transition = 'transform 90ms'
        this.el.eyeR.style.transition = 'transform 90ms'
        const base = this.el.eyeL.style.transform || 'scaleY(1)'
        this.el.eyeL.style.transform = 'scaleY(0.08)'
        this.el.eyeR.style.transform = 'scaleY(0.08)'
        setTimeout(() => {
          this.el.eyeL.style.transform = base
          this.el.eyeR.style.transform = base
        }, 110)
      }

      this._raf = requestAnimationFrame(step)
    }
    this._raf = requestAnimationFrame(step)
  }

  destroy() {
    cancelAnimationFrame(this._raf)
  }
}
