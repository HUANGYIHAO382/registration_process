/**
 * 同意与隐私：绑前明示同意、脱敏展示、本地审计条目
 */
import { reactive } from 'vue'

const state = reactive({
  privacyAccepted: false,
  audit: [],
})

export function getConsentState() {
  return state
}

export function acceptPrivacy() {
  state.privacyAccepted = true
  pushAudit('CONSENT_ACCEPT', { at: Date.now() })
}

export function resetConsent() {
  state.privacyAccepted = false
}

/** 证件号脱敏：只留后四位 */
export function maskIdCard(id) {
  const s = String(id || '')
  if (s.length < 4) return '****'
  return '*'.repeat(Math.max(0, s.length - 4)) + s.slice(-4)
}

/** 手机号脱敏 */
export function maskPhone(phone) {
  const s = String(phone || '')
  if (s.length < 7) return '****'
  return s.slice(0, 3) + '****' + s.slice(-4)
}

export function pushAudit(type, detail = {}) {
  // Demo：内存审计；不上送明文证件号
  const safe = { ...detail }
  if (safe.idCard) safe.idCard = maskIdCard(safe.idCard)
  if (safe.phone) safe.phone = maskPhone(safe.phone)
  state.audit.push({ type, detail: safe, ts: Date.now() })
  if (state.audit.length > 200) state.audit.shift()
}
