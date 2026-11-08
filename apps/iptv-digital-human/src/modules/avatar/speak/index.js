/**
 * 说话模块：先文字字幕，再可选 TTS
 * Demo 默认 mode = 'text'（大字幕打字机 + 嘴型节奏），可不播声音
 */
import { getProviderState } from '../../api-switch/index.js'

/**
 * 浏览器 TTS（可选）。text 模式下默认不强制出声，由调用方决定。
 */
export function createSpeaker() {
  const state = {
    rate: 0.88,
    voice: null,
    ready: false,
  }

  function init() {
    if (!('speechSynthesis' in window)) return
    const load = () => {
      const vs = speechSynthesis.getVoices()
      if (!vs.length) return
      state.voice =
        vs.find((v) => /^zh[-_]CN/i.test(v.lang) && /xiaoxiao|huihui|yaoyao|kangkang|female/i.test(v.name)) ||
        vs.find((v) => /^zh/i.test(v.lang)) ||
        null
      state.ready = true
    }
    load()
    speechSynthesis.onvoiceschanged = load
    const cfgRate = getProviderState().tts?.rate
    if (cfgRate != null) state.rate = cfgRate
  }

  function stop() {
    try {
      speechSynthesis.cancel()
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {string} text
   * @param {{ onBoundary?: (charIndex: number) => void, onEnd?: () => void }} hooks
   */
  function speak(text, hooks = {}) {
    stop()
    if (!('speechSynthesis' in window) || !text) {
      hooks.onEnd?.()
      return
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = state.rate
    if (state.voice) u.voice = state.voice
    u.onboundary = (e) => {
      if (typeof e.charIndex === 'number') hooks.onBoundary?.(e.charIndex)
    }
    u.onend = () => hooks.onEnd?.()
    u.onerror = () => hooks.onEnd?.()
    speechSynthesis.speak(u)
  }

  return { init, speak, stop, state }
}

/**
 * 打字机字幕控制器：把完整回复拆成字符 span，高亮当前读到的位置
 */
export function createTypewriter() {
  let chars = ''

  function reset() {
    chars = ''
    return ''
  }

  function append(delta) {
    chars += delta || ''
    return chars
  }

  function getText() {
    return chars
  }

  return { reset, append, getText }
}
