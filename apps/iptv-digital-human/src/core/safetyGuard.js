/**
 * 安全护栏：危急词本地短路，绝不交给大模型判断
 * 命中后由上层进入 EMERGENCY + 固定话术 + 红屏 120
 */

const EMERGENCY_PATTERNS = [
  '胸口疼',
  '胸痛',
  '心口疼',
  '喘不上气',
  '呼吸困难',
  '憋气',
  '说不出话',
  '讲话不清',
  '嘴歪',
  '半边身子',
  '半身麻',
  '呕血',
  '吐血',
  '大出血',
  '拉黑便',
  '昏倒',
  '晕倒',
  '晕过去',
  '抽过去',
  '抽搐',
  '意识不清',
  '叫不醒',
  '心梗',
  '中风',
  '脑梗',
]

export const EMERGENCY_REPLY =
  '这可能是需要马上处理的急症，先别挂电话，也别自己去医院。' +
  '请立刻拨打 120，或者让家里人马上打。' +
  '在等车的时候，先坐下来或者躺下来，把领口松开，不要走动，也不要自己开车。' +
  '如果家里有阿司匹林，先不要吃，等医生来了再说。' +
  '我现在把急救电话显示在大屏幕上。'

/**
 * @param {string} text
 * @returns {{ hit: boolean, word?: string }}
 */
export function checkSafety(text) {
  const t = (text || '').replace(/\s/g, '')
  for (const p of EMERGENCY_PATTERNS) {
    if (t.includes(p)) return { hit: true, word: p }
  }
  return { hit: false }
}
