/**
 * 预占与下单（Mock）
 * 支付定稿：电视只预约，费用到院再缴
 */
import { pushAudit } from '../consent/index.js'

function authHeader() {
  const t = sessionStorage.getItem('yihong_token')
  return t ? { authorization: `Bearer ${t}`, 'content-type': 'application/json' } : { 'content-type': 'application/json' }
}

/** 简单在线探测：失败则禁止写操作 */
export async function assertOnline() {
  try {
    const res = await fetch('/api/health', { method: 'GET' })
    if (!res.ok) throw new Error('offline')
    return true
  } catch {
    const e = new Error('当前网络不稳定，暂时不能预约，请稍后再试')
    e.code = 'OFFLINE_FORBIDDEN'
    throw e
  }
}

/**
 * 预占号源（默认 120 秒）
 */
export async function holdSlot({ slotId, patientId, department, idempotencyKey }) {
  await assertOnline()
  const res = await fetch('/api/order/hold', {
    method: 'POST',
    headers: {
      ...authHeader(),
      'x-idempotency-key': idempotencyKey || `hold_${slotId}_${Date.now()}`,
    },
    body: JSON.stringify({
      tenantId: 'tenant_demo',
      slotId,
      patientId,
      department,
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    const e = new Error(data.message || data.code || 'HOLD_FAILED')
    e.code = data.code
    throw e
  }
  pushAudit('HOLD_CREATED', { holdId: data.holdId, slotId })
  return data
}

/**
 * 确认预约（与 hold 使用不同幂等键）
 */
export async function confirmOrder({ holdId, idempotencyKey }) {
  await assertOnline()
  const res = await fetch('/api/order/confirm', {
    method: 'POST',
    headers: {
      ...authHeader(),
      'x-idempotency-key': idempotencyKey || `confirm_${holdId}_${Date.now()}`,
    },
    body: JSON.stringify({ tenantId: 'tenant_demo', holdId }),
  })
  const data = await res.json()
  if (!res.ok) {
    const e = new Error(data.message || data.code || 'CONFIRM_FAILED')
    e.code = data.code
    throw e
  }
  pushAudit('ORDER_CONFIRMED', { orderId: data.orderId, ticketNo: data.ticketNo })
  return data
}
