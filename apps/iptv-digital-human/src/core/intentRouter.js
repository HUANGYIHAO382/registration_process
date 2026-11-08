/**
 * 意图路由：在安全检查之后、剧本/LLM 之前
 * 只做关键词粗分，不做诊断
 */

const INTENTS = [
  {
    id: 'appointment',
    words: [
      '挂号',
      '挂个',
      '挂一',
      '挂专',
      '挂心',
      '挂哪',
      '预约',
      '约个',
      '约号',
      '约一下',
      '看病',
      '看医生',
      '门诊',
      '号源',
      '有号',
      '心内科',
      '心血管',
      '内分泌',
      '神经内科',
      '呼吸科',
      '消化科',
      '骨科',
      '眼科',
      '口腔',
      '妇科',
      '儿科',
      '皮肤科',
      '耳鼻喉',
      '泌尿',
      '中医科',
      '科室',
      '头晕',
      '头痛',
      '咳嗽',
      '发烧',
      '肚子疼',
      '胃痛',
    ],
  },
  { id: 'bp', words: ['血压', '高血压', '降压'] },
  { id: 'sugar', words: ['血糖', '糖尿病', '降糖', '胰岛素'] },
  { id: 'meds', words: ['吃药', '用药', '药怎么', '忘了吃', '漏吃', '副作用', '忘吃药', '药盒'] },
  { id: 'report', words: ['报告', '化验', '检查结果', '结果出来', '片子', '验血'] },
  { id: 'revisit', words: ['复诊', '复查', '随访'] },
  { id: 'greeting', words: ['你好', '在吗', '早上好', '下午好', '你是谁', '叫什么'] },
]

/**
 * @param {string} text
 * @returns {string} intent id
 */
export function routeIntent(text) {
  const t = (text || '').replace(/\s/g, '')
  for (const it of INTENTS) {
    if (it.words.some((w) => t.includes(w))) return it.id
  }
  return 'unknown'
}

/** 用户是否已经点名科室（用于挂号剧本跳过追问） */
export function hasDepartmentMention(text) {
  return /心内科|心血管|内分泌|神经内科|呼吸科|消化科|骨科|眼科|口腔|妇科|儿科|皮肤科|耳鼻喉|泌尿|中医科/.test(
    text || ''
  )
}
