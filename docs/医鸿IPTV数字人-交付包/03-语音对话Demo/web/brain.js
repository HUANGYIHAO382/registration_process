/**
 * Brain —— 对话大脑
 *
 * 顺序是硬要求：安全规则 → 意图路由 → (Mock 剧本 | 大模型)
 * 危急词绝不允许交给大模型判断，命中即短路。
 */

/* ------------------------------------------------------------ 安全规则 */

const EMERGENCY_PATTERNS = [
  '胸口疼', '胸痛', '心口疼', '喘不上气', '呼吸困难', '憋气',
  '说不出话', '讲话不清', '嘴歪', '半边身子', '半身麻',
  '呕血', '吐血', '大出血', '拉黑便',
  '昏倒', '晕倒', '晕过去', '抽过去', '抽搐', '意识不清', '叫不醒',
  '心梗', '中风', '脑梗',
]

export function checkSafety(text) {
  const t = (text || '').replace(/\s/g, '')
  for (const p of EMERGENCY_PATTERNS) {
    if (t.includes(p)) return { hit: true, word: p }
  }
  return { hit: false }
}

export const EMERGENCY_REPLY =
  '这可能是需要马上处理的急症，先别挂电话，也别自己去医院。' +
  '请立刻拨打 120，或者让家里人马上打。' +
  '在等车的时候，先坐下来或者躺下来，把领口松开，不要走动，也不要自己开车。' +
  '如果家里有阿司匹林，先不要吃，等医生来了再说。' +
  '我现在把急救电话显示在大屏幕上。'

/* ------------------------------------------------------------ 意图路由 */

const INTENTS = [
  { id: 'emergency', words: [] },
  {
    id: 'appointment',
    words: [
      '挂号', '挂个', '挂一', '挂专', '挂心', '挂哪', '预约', '约个', '约号', '约一下',
      '看病', '看医生', '门诊', '号源', '有号',
      '心内科', '心血管', '内分泌', '神经内科', '呼吸科', '消化科', '骨科', '眼科',
      '口腔', '妇科', '儿科', '皮肤科', '耳鼻喉', '泌尿', '中医科', '科室',
    ],
  },
  { id: 'bp', words: ['血压', '高血压', '头晕', '降压'] },
  { id: 'sugar', words: ['血糖', '糖尿病', '降糖', '胰岛素'] },
  { id: 'meds', words: ['吃药', '用药', '药怎么', '忘了吃', '漏吃', '副作用', '忘吃药', '药盒'] },
  { id: 'report', words: ['报告', '化验', '检查结果', '结果出来', '片子', '验血'] },
  { id: 'revisit', words: ['复诊', '复查', '随访'] },
  { id: 'greeting', words: ['你好', '在吗', '早上好', '下午好', '你是谁', '叫什么'] },
]

export function routeIntent(text) {
  const t = (text || '').replace(/\s/g, '')
  for (const it of INTENTS) {
    if (!it.words.length) continue
    if (it.words.some((w) => t.includes(w))) return it.id
  }
  return 'unknown'
}

/* ------------------------------------------------------------ Mock 剧本 */

// 每个意图两轮：先追问，再给科普 + 引导。第三轮起走兜底。
const SCRIPT = {
  greeting: {
    once: ['您好，我是医小鸿，龙华人民医院的健康助手。', '您说哪里不舒服，或者想办什么事，我都能帮您看看。'],
    again: ['我在呢。', '您慢慢说，不着急。'],
  },
  bp: {
    once: [
      '血压高的时候头晕，确实不好受。',
      '我想先问一句：您今天量血压了吗？量出来是多少？',
    ],
    again: [
      '记下了。您这个情况，我建议这几天早晚各量一次，量之前先坐着歇五分钟，别刚走完路就量。',
      '另外盐要少吃一点，咸菜、腊肉这些尽量少碰。',
      '如果连着三天都偏高，最好来医院让医生调一下药，我也可以现在帮您挂号。',
    ],
  },
  sugar: {
    once: ['血糖的事我帮您记着。', '您最近一次测空腹血糖是多少？是早上空腹测的吗？'],
    again: [
      '空腹血糖一般控制在七以下比较稳妥，饭后两小时最好在十以下。',
      '吃饭的顺序也有讲究：先吃菜，再吃肉，最后吃主食，血糖会升得慢一些。',
      '如果最近老是忽高忽低，建议来查一次糖化血红蛋白，我帮您约内分泌科，好吗？',
    ],
  },
  meds: {
    once: ['吃药这事不能马虎。', '您说的是哪一种药？是降压药，还是降糖药？'],
    again: [
      '降压药一般早上吃，降糖药要看着饭点吃，具体还是按医生开的来。',
      '如果漏吃了一次，不要下一次吃两倍，正常吃就好，这一点很重要。',
      '要是吃药以后觉得头晕、心慌，先坐下来歇着，然后打给我，或者直接找医生。',
    ],
  },
  report: {
    once: ['报告我帮您调出来。', '您是哪天做的检查？是抽血，还是B超、CT？'],
    again: [
      '报告里如果有箭头往上或往下，先别慌，单项高一点不一定有问题。',
      '真正要看的是医生怎么结合您的情况判断，我可以把关键几项念给您听。',
      '要不要我帮您约一下复诊，让医生当面讲一遍？',
    ],
  },
  revisit: {
    once: ['复诊我帮您安排。', '您是哪个科开的复诊？大概什么时候该去了？'],
    again: [
      '复诊前一天，我会在电视上提醒您一次，也会提醒您空腹还是不空腹。',
      '记得把上次的报告和药盒带上，医生看这些最省时间。',
      '要现在帮您约好时间吗？',
    ],
  },
  appointment: {
    once: ['好，我帮您挂号。', '您先说说是哪里不舒服，我给您找对应的科室。'],
    again: [
      '明白了。按您说的情况，建议挂心血管内科，普通门诊就可以。',
      '我找到三个时间还有号：明天上午九点、明天上午九点半、后天下午两点。',
      '您说「第一个」，或者按方向键选一个。',
    ],
  },
  unknown: {
    once: ['我听到了，不过我还没完全弄明白您的意思。', '您是想问身体不舒服，还是想办挂号、查报告这些事？'],
    again: ['这个我可能帮不上太多。', '我能做的是：讲健康知识、帮您挂号、查报告、提醒吃药和复诊。您看要办哪一件？'],
  },
}

/* ------------------------------------------------------------ Brain */

export class Brain {
  constructor({ llmEnabled = false, systemPrompt = '' } = {}) {
    this.llmEnabled = llmEnabled
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
   * @returns {AsyncGenerator<{delta:string}>}
   */
  async *ask(userText) {
    // 1. 安全前置（5ms 级，命中即结束）
    const safe = checkSafety(userText)
    if (safe.hit) {
      yield { delta: EMERGENCY_REPLY, emergency: true, word: safe.word }
      return
    }

    // 2. 意图路由
    const intent = routeIntent(userText)
    this.intentCount[intent] = (this.intentCount[intent] || 0) + 1

    // 3. 大模型通道
    if (this.llmEnabled) {
      let got = false
      for await (const chunk of this._llm(userText)) {
        got = true
        yield chunk
      }
      if (got) return
      // 大模型失败静默降级到剧本
    }

    // 4. Mock 剧本
    const s = SCRIPT[intent] || SCRIPT.unknown
    // 用户已经说清科室了，就别再问"哪里不舒服"，直接给号源
    const deptSaid = /心内科|心血管|内分泌|神经内科|呼吸科|消化科|骨科|眼科|口腔|妇科|儿科|皮肤科|耳鼻喉|泌尿|中医科/.test(userText)
    const filled = this.intentCount[intent] > 1 || (intent === 'appointment' && deptSaid)
    const lines = filled ? s.again : s.once
    const text = lines.join('')
    // 逐字吐出，模拟流式，让字幕效果和真模型一致
    for (let i = 0; i < text.length; i += 3) {
      yield { delta: text.slice(i, i + 3) }
      await new Promise((r) => setTimeout(r, 26))
      if (this._abort?.signal.aborted) return
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
          } catch {}
        }
      }
    } catch {
      /* 打断 */
    }
    if (full) this.history.push({ role: 'assistant', content: full })
  }
}

export const DEFAULT_SYSTEM_PROMPT = `你是深圳龙华人民医院在 IPTV 电视上的健康助手「医小鸿」，主要服务老年慢病患者。

硬性规则，任何情况下都不能违反：
1. 不做诊断，不下结论，不给药物剂量，不判断检查结果的好坏。
2. 只做健康科普、导诊、预约挂号、报告查询、用药与复诊提醒。
3. 遇到胸痛、呼吸困难、意识不清、呕血、抽搐等急症描述，立刻让对方拨打 120，不要继续科普。
4. 语言口语化，像跟老人当面说话。每句话不超过 20 个字，一次只说一件事，一次只问一个问题。
5. 不说专业术语。必须说的时候，用一句话解释清楚。
6. 数字要说人话：不说"14:30"，说"下午两点半"。
7. 涉及用药，一律加一句"具体还是按医生开的来"。
8. 每次回答控制在 3 句话以内，结尾给一个明确的选择，比如"要我帮您挂号吗"。
9. 不确定的事就说不知道，不要编。`
