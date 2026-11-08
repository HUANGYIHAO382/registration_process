/**
 * 身份绑定子模块（Mock）
 * 流 A：电视出码 → 手机扫/输码
 * 流 B：先导诊再绑
 * 流 C：家庭成员代操作提示
 */
import { getProviderState } from '../../api-switch/index.js'
import { getConsentState, pushAudit } from '../consent/index.js'

/**
 * 向服务端申请绑定码
 */
export async function createBindSession() {
  if (!getConsentState().privacyAccepted) {
    const err = new Error('CONSENT_REQUIRED')
    err.code = 'CONSENT_REQUIRED'
    throw err
  }
  const variant = getProviderState().bind.activeVariant
  const res = await fetch('/api/bind/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tenantId: 'tenant_demo',
      variant,
      deviceId: localStorage.getItem('yihong_device_id') || createDeviceId(),
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    const e = new Error(data.message || data.code || 'BIND_FAILED')
    e.code = data.code
    throw e
  }
  pushAudit('BIND_SESSION_CREATED', { variant, codeHint: String(data.code || '').slice(0, 2) + '****' })
  return data
}

function createDeviceId() {
  const id = 'dev_' + Math.random().toString(16).slice(2) + Date.now().toString(16)
  localStorage.setItem('yihong_device_id', id)
  return id
}

/** 模拟手机侧确认绑定（Demo 一键完成） */
export async function mockConfirmBind(sessionId, code) {
  const res = await fetch('/api/bind/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, code, tenantId: 'tenant_demo' }),
  })
  const data = await res.json()
  if (!res.ok) {
    const e = new Error(data.message || data.code || 'BIND_CONFIRM_FAILED')
    e.code = data.code
    throw e
  }
  if (data.deviceSessionToken) {
    sessionStorage.setItem('yihong_token', data.deviceSessionToken)
  }
  pushAudit('BIND_CONFIRMED', { sessionId })
  // 实验埋点（无身份证明文）
  try {
    await fetch('/api/experiment/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event: 'bind_success',
        variant: getProviderState().bind.activeVariant,
        sessionId,
        ts: Date.now(),
      }),
    })
  } catch {
    /* ignore */
  }
  return data
}

export function getDeviceToken() {
  return sessionStorage.getItem('yihong_token') || ''
}

export function clearDeviceToken() {
  sessionStorage.removeItem('yihong_token')
}
