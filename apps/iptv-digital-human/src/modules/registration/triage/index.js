/**
 * 症状导诊：规则映射科室（Demo）
 * 真正复杂知识库可替换本模块而不改 UI
 */

const RULES = [
  { dept: '心血管内科', words: ['胸闷', '心慌', '血压', '头晕', '心脏', '心血管', '心内科'] },
  { dept: '内分泌科', words: ['血糖', '糖尿病', '口渴', '尿多', '内分泌'] },
  { dept: '呼吸内科', words: ['咳嗽', '发烧', '气喘', '嗓子', '呼吸'] },
  { dept: '消化内科', words: ['肚子疼', '胃痛', '反酸', '腹泻', '消化'] },
  { dept: '神经内科', words: ['头痛', '手脚麻', '神经'] },
  { dept: '骨科', words: ['腰疼', '膝盖', '骨折', '骨科'] },
]

/**
 * @param {string} symptomText
 * @returns {{ department: string, reason: string, confidence: number }}
 */
export function suggestDepartment(symptomText) {
  const t = symptomText || ''
  for (const r of RULES) {
    if (r.words.some((w) => t.includes(w))) {
      return {
        department: r.dept,
        reason: `根据您提到的「${r.words.find((w) => t.includes(w))}」，建议挂${r.dept}`,
        confidence: 0.82,
      }
    }
  }
  return {
    department: '全科医学科',
    reason: '暂时不能精确对应专科，建议先挂全科，由医生帮您分流',
    confidence: 0.55,
  }
}
