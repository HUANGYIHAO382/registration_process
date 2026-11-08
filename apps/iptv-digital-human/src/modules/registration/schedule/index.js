/**
 * 排班号源（Mock）：最多返回 3 个候选
 */
export async function listSlots({ department }) {
  try {
    const q = new URLSearchParams({ department: department || '心血管内科' })
    const res = await fetch('/api/schedule/slots?' + q.toString())
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.slots)) return data.slots.slice(0, 3)
    }
  } catch {
    /* 本地兜底 */
  }
  // 本地兜底三档，口语化时间
  return [
    {
      slotId: 'slot_1',
      label: '明天上午九点',
      doctorName: '王医生',
      clinicType: '普通门诊',
      remain: 5,
    },
    {
      slotId: 'slot_2',
      label: '明天上午九点半',
      doctorName: '李医生',
      clinicType: '普通门诊',
      remain: 3,
    },
    {
      slotId: 'slot_3',
      label: '后天下午两点',
      doctorName: '赵医生',
      clinicType: '普通门诊',
      remain: 8,
    },
  ]
}
