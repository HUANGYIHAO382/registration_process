/**
 * 家庭就诊人（Mock）
 */
import { maskIdCard, maskPhone } from '../consent/index.js'

/** Demo 固定家庭成员 */
const MEMBERS = [
  {
    id: 'p1',
    name: '张大爷',
    relation: '本人',
    idCard: '440306195001011234',
    phone: '13800138001',
  },
  {
    id: 'p2',
    name: '张奶奶',
    relation: '配偶',
    idCard: '440306195203031234',
    phone: '13800138002',
  },
  {
    id: 'p3',
    name: '小张',
    relation: '子女代约',
    idCard: '440306199001011234',
    phone: '13900139000',
  },
]

export async function listPatients() {
  // 也可走 /api/family/patients；首期直接本地 Mock，形状与契约一致
  try {
    const res = await fetch('/api/family/patients', {
      headers: authHeader(),
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.patients) && data.patients.length) return data.patients.map(toView)
    }
  } catch {
    /* 降级本地 */
  }
  return MEMBERS.map(toView)
}

function toView(p) {
  return {
    id: p.id,
    name: p.name,
    relation: p.relation,
    idCardMasked: maskIdCard(p.idCard),
    phoneMasked: maskPhone(p.phone),
    // 内部确认页仍需完整字段时，由服务端 hold 使用 id，前端不展示明文
    _rawIdCard: p.idCard,
  }
}

function authHeader() {
  const t = sessionStorage.getItem('yihong_token')
  return t ? { authorization: `Bearer ${t}` } : {}
}

export function findPatientById(list, id) {
  return list.find((p) => p.id === id) || null
}
