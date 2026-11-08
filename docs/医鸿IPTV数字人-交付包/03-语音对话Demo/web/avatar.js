/**
 * Avatar —— 数字人形象（纯 SVG，无外部资源）
 *
 * 两个角色：nurse（医小鸿）/ doctor（鸿医生）
 * 对外只有四个方法：setViseme / setEmotion / startSpeak / stopSpeak
 *
 * 口型说明：8 个 viseme 形状之间用插值过渡，避免"啪"地跳变。
 * 当前口型由语速节奏驱动（约 9 帧/秒），不是真实音素驱动；
 * 接入返回音素时间戳的 TTS 后，只要改成按时间戳调 setViseme 即可，界面代码不用动。
 */

const VISEME = {
  sil: { rx: 15, ry: 1.6, op: 0 },
  m: { rx: 13, ry: 2.2, op: 0 },
  a: { rx: 19, ry: 15, op: 1 },
  e: { rx: 19, ry: 10, op: 1 },
  i: { rx: 24, ry: 6.5, op: 1 },
  o: { rx: 14, ry: 14, op: 1 },
  u: { rx: 10, ry: 10, op: 1 },
  smile: { rx: 20, ry: 7, op: 0 },
}

const SPEAK_SEQ = ['a', 'e', 'o', 'i', 'm', 'a', 'u', 'e', 'm', 'o', 'i', 'a', 'e', 'm']

export class Avatar {
  constructor(host, kind = 'nurse') {
    this.host = host
    this.kind = kind
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

    host.innerHTML = this._template(kind)
    this._cache()
    this._loop()
  }

  /* ------------------------------------------------------------ 结构 */

  _template(kind) {
    const isNurse = kind === 'nurse'
    const skin = '#F3D9C6'
    const skinShade = '#E4C0A8'
    const coat = isNurse ? '#E8F5F1' : '#F6F8F7'
    const accent = isNurse ? '#12B39B' : '#1D6F63'
    const hair = isNurse ? '#3A2E2A' : '#2B2521'

    const hairShape = isNurse
      ? `
        <ellipse cx="260" cy="292" rx="136" ry="150" fill="${hair}"/>
        <circle cx="260" cy="132" r="40" fill="${hair}"/>
        <circle cx="260" cy="132" r="40" fill="url(#hairGloss)" opacity="0.35"/>
      `
      : `
        <ellipse cx="260" cy="288" rx="126" ry="140" fill="${hair}"/>
      `

    const fringe = isNurse
      ? `<path d="M150 268 C162 190 204 158 260 158 C316 158 358 190 370 268 C348 232 306 216 260 216 C214 216 172 232 150 268 Z" fill="${hair}"/>`
      : `<path d="M154 258 C170 186 208 160 260 160 C312 160 350 186 366 258 C344 222 306 208 260 208 C214 208 176 222 154 258 Z" fill="${hair}"/>`

    const torso = isNurse
      ? `
        <path d="M8 880 C8 758 38 686 94 652 C148 618 194 592 216 512 L304 512 C326 592 372 618 426 652 C482 686 512 758 512 880 Z" fill="${coat}"/>
        <path d="M216 512 L260 620 L304 512 L322 522 L260 664 L198 522 Z" fill="${accent}" opacity="0.18"/>
        <path d="M226 522 L260 606 L294 522" stroke="${accent}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
        <path d="M104 700 C96 780 98 838 102 880" stroke="#CFE3DC" stroke-width="4" fill="none" opacity="0.7"/>
        <path d="M416 700 C424 780 422 838 418 880" stroke="#CFE3DC" stroke-width="4" fill="none" opacity="0.7"/>
        <circle cx="356" cy="700" r="22" fill="${accent}" opacity="0.20"/>
        <path d="M347 700 h18 M356 691 v18" stroke="${accent}" stroke-width="4.5" stroke-linecap="round"/>
      `
      : `
        <path d="M6 880 C6 756 36 684 92 650 C146 616 192 590 214 510 L306 510 C328 590 374 616 428 650 C484 684 514 756 514 880 Z" fill="${coat}"/>
        <path d="M214 510 L260 640 L306 510 L330 520 L260 688 L190 520 Z" fill="#DCE6E2"/>
        <path d="M214 510 L260 640 L306 510" stroke="#C6D6D1" stroke-width="4" fill="none"/>
        <path d="M430 604 C430 700 458 732 478 732 C494 732 506 718 506 696" stroke="#2F4A44" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.5"/>
        <circle cx="430" cy="604" r="13" fill="#2F4A44" opacity="0.5"/>
        <path d="M198 592 C198 686 220 716 236 716 C248 716 256 706 256 692" stroke="#2F4A44" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.5"/>
        <circle cx="198" cy="592" r="13" fill="#2F4A44" opacity="0.5"/>
        <rect x="330" y="676" width="32" height="24" rx="3" fill="none" stroke="#B9CCC6" stroke-width="4"/>
        <path d="M337 683 h18 M337 692 h12" stroke="#B9CCC6" stroke-width="3" stroke-linecap="round"/>
      `

    return `
<svg viewBox="0 0 520 880" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="halo" cx="50%" cy="38%" r="62%">
      <stop offset="0%" stop-color="#12B39B" stop-opacity="0.26"/>
      <stop offset="55%" stop-color="#12B39B" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#12B39B" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hairGloss" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="coatGrad" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="fadeGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="80%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <mask id="bottomFade" maskUnits="userSpaceOnUse" x="0" y="0" width="520" height="880">
      <rect x="0" y="0" width="520" height="880" fill="url(#fadeGrad)"/>
    </mask>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>

  <ellipse cx="260" cy="330" rx="300" ry="330" fill="url(#halo)"/>
  <ellipse cx="260" cy="852" rx="190" ry="26" fill="#000" opacity="0.35" filter="url(#soft)"/>

  <g id="figure" mask="url(#bottomFade)">
    <!-- 身体 -->
    <g>${torso}</g>
    <path d="M224 392 h72 v142 q-36 18 -72 0 Z" fill="${skinShade}"/>

    <!-- 头 -->
    <g id="head">
      ${hairShape}
      <ellipse cx="260" cy="298" rx="118" ry="140" fill="${skin}"/>
      <ellipse cx="144" cy="306" rx="17" ry="24" fill="${skinShade}"/>
      <ellipse cx="376" cy="306" rx="17" ry="24" fill="${skinShade}"/>
      ${fringe}

      <!-- 眉 -->
      <g id="browL" stroke="${hair}" stroke-width="8" stroke-linecap="round" fill="none">
        <path d="M198 258 q22 -12 44 -2"/>
      </g>
      <g id="browR" stroke="${hair}" stroke-width="8" stroke-linecap="round" fill="none">
        <path d="M278 256 q22 -10 44 2"/>
      </g>

      <!-- 眼 -->
      <g id="eyes">
        <g id="eyeL">
          <ellipse cx="216" cy="300" rx="22" ry="14" fill="#FFFFFF"/>
          <circle cx="218" cy="301" r="9.5" fill="#2C3A34"/>
          <circle cx="221" cy="297" r="3.2" fill="#FFFFFF" opacity="0.9"/>
        </g>
        <g id="eyeR">
          <ellipse cx="304" cy="300" rx="22" ry="14" fill="#FFFFFF"/>
          <circle cx="306" cy="301" r="9.5" fill="#2C3A34"/>
          <circle cx="309" cy="297" r="3.2" fill="#FFFFFF" opacity="0.9"/>
        </g>
      </g>

      <!-- 鼻 -->
      <path d="M258 330 q-9 14 2 20" stroke="${skinShade}" stroke-width="5" fill="none" stroke-linecap="round"/>

      <!-- 嘴：椭圆负责张口，path 负责闭口/微笑 -->
      <ellipse id="mouth" cx="260" cy="374" rx="15" ry="1.6" fill="#7A3B36"/>
      <path id="mouthLine" d="M245 374 q15 5 30 0" stroke="#8A4A44" stroke-width="5" fill="none" stroke-linecap="round" opacity="1"/>
      <path id="mouthSmile" d="M240 370 q20 18 40 0" stroke="#8A4A44" stroke-width="5" fill="none" stroke-linecap="round" opacity="0"/>

      <!-- 腮红 -->
      <ellipse cx="180" cy="340" rx="24" ry="14" fill="#E8836F" opacity="0.13"/>
      <ellipse cx="340" cy="340" rx="24" ry="14" fill="#E8836F" opacity="0.13"/>
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

  /* ------------------------------------------------------------ 对外 */

  setKind(kind) {
    if (kind === this.kind) return
    this.kind = kind
    this.host.innerHTML = this._template(kind)
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
      neutral: { browY: 0, browRot: 0, eyeRy: 14, smile: 0 },
      smile: { browY: -3, browRot: 0, eyeRy: 11, smile: 0 },
      concern: { browY: 3, browRot: 10, eyeRy: 15, smile: 1 },
      listen: { browY: -5, browRot: 0, eyeRy: 16, smile: 1 },
      alert: { browY: 5, browRot: -8, eyeRy: 17, smile: 1 },
    }[name] || {}

    e.browL.setAttribute('transform', `translate(0 ${cfg.browY}) rotate(${-cfg.browRot} 220 258)`)
    e.browR.setAttribute('transform', `translate(0 ${cfg.browY}) rotate(${cfg.browRot} 300 258)`)
    e.eyeL.style.transformBox = 'fill-box'
    e.eyeR.style.transformBox = 'fill-box'
    e.eyeL.style.transformOrigin = 'center'
    e.eyeR.style.transformOrigin = 'center'
    e.eyeL.style.transform = `scaleY(${cfg.eyeRy / 14})`
    e.eyeR.style.transform = `scaleY(${cfg.eyeRy / 14})`
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

  /* ------------------------------------------------------------ 动画 */

  _loop() {
    const step = () => {
      const now = performance.now()
      const dt = now - this._t0

      // 说话时按节奏切换口型
      if (this.speaking) {
        this._seqClock += 16
        if (this._seqClock > 105) {
          this._seqClock = 0
          const next = SPEAK_SEQ[this._seqIdx % SPEAK_SEQ.length]
          this._seqIdx++
          this.setViseme(next)
        }
      }

      // 口型插值
      const k = 0.32
      this.cur.rx += (this.target.rx - this.cur.rx) * k
      this.cur.ry += (this.target.ry - this.cur.ry) * k
      this.cur.op += (this.target.op - this.cur.op) * k

      const open = this.cur.ry > 3
      this.el.mouth.setAttribute('rx', this.cur.rx.toFixed(2))
      this.el.mouth.setAttribute('ry', this.cur.ry.toFixed(2))
      this.el.mouth.setAttribute('opacity', this.cur.op.toFixed(2))
      this.el.mouthLine.setAttribute('opacity', (1 - this.cur.op).toFixed(2))
      const smiling = this.emotion === 'smile' || this.emotion === 'listen'
      this.el.mouthSmile.setAttribute('opacity', !open && smiling ? '1' : '0')
      this.el.mouthLine.setAttribute('opacity', !open && !smiling ? '1' : '0')

      // 呼吸 + 说话点头
      const breathe = Math.sin(dt / 1600) * 3
      const bob = this.speaking ? Math.sin(dt / 170) * 2.4 : 0
      this.el.figure.setAttribute(
        'transform',
        `translate(0 ${(breathe + bob).toFixed(2)}) rotate(${(this.speaking ? Math.sin(dt / 420) * 0.5 : 0).toFixed(2)} 260 700)`
      )

      // 眨眼
      if (now > this._blinkAt) {
        this._blinkAt = now + 2600 + Math.random() * 2600
        this.el.eyeL.style.transition = 'transform 90ms'
        this.el.eyeR.style.transition = 'transform 90ms'
        const base = this.el.eyeL.style.transform || 'scaleY(1)'
        this.el.eyeL.style.transform = 'scaleY(0.12)'
        this.el.eyeR.style.transform = 'scaleY(0.12)'
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
