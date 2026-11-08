/**
 * AI 对话编排：安全 → 意图 →（剧本 | 云端 LLM）
 * 不碰麦克风；不写号源锁
 */
import { checkSafety, EMERGENCY_REPLY } from '../../core/safetyGuard.js'
import { hasDepartmentMention, routeIntent } from '../../core/intentRouter.js'
import { isLlmCloud } from '../api-switch/index.js'
import { DEFAULT_SYSTEM_PROMPT, SCRIPT } from './scripts.js'

export { DEFAULT_SYSTEM_PROMPT, SCRIPT }

export class Brain {
  constructor({ systemPrompt = DEFAULT_SYSTEM_PROMPT } = {}) {
    this.systemPrompt = systemPrompt
    this.history = []
    this.intentCount = {}
    this._abort = null
  }

  reset() {
    this.history = []
    this.intentCount = {}
  }

  abort() {
    if (this._abort) this._abort.abort()
    this._abort = null
  }

  /**
   * 统一出口：异步产出文本增量
   * @returns {AsyncGenerator<{delta:string, emergency?:boolean, word?:string, intent?:string}>}
   */
  async *ask(userText) {
    const safe = checkSafety(userText)
    if (safe.hit) {
      yield { delta: EMERGENCY_REPLY, emergency: true, word: safe.word, intent: 'emergency' }
      return
    }

    const intent = routeIntent(userText)
    this.intentCount[intent] = (this.intentCount[intent] || 0) + 1

    // 云端大模型（由 api-switch 决定是否启用）
    if (isLlmCloud()) {
      let got = false
      for await (const chunk of this._llm(userText)) {
        got = true
        yield { ...chunk, intent }
      }
      if (got) return
      // 失败静默降级到剧本
    }

    const s = SCRIPT[intent] || SCRIPT.unknown
    const filled =
      this.intentCount[intent] > 1 || (intent === 'appointment' && hasDepartmentMention(userText))
    const lines = filled ? s.again : s.once
    const text = lines.join('')

    // 逐字吐出，模拟流式，方便字幕与嘴型同步
    this._abort = new AbortController()
    for (let i = 0; i < text.length; i += 3) {
      if (this._abort.signal.aborted) return
      yield { delta: text.slice(i, i + 3), intent }
      await new Promise((r) => setTimeout(r, 26))
    }
  }

  async *_llm(userText) {
    this._abort = new AbortController()
    this.history.push({ role: 'user', content: userText })
    const messages = [{ role: 'system', content: this.systemPrompt }, ...this.history.slice(-6)]

    let res
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages }),
        signal: this._abort.signal,
      })
    } catch {
      return
    }
    if (!res.ok || !res.body) return

    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    let full = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          const s = line.trim()
          if (!s.startsWith('data:')) continue
          const payload = s.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const j = JSON.parse(payload)
            const d = j.choices?.[0]?.delta?.content
            if (d) {
              full += d
              yield { delta: d }
            }
          } catch {
            /* 半包忽略 */
          }
        }
      }
    } catch {
      /* 打断 */
    }
    if (full) this.history.push({ role: 'assistant', content: full })
  }
}
