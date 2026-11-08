/**
 * 会话状态机（对话半双工）
 * IDLE → LISTENING → THINKING → SPEAKING → IDLE
 * 任意时刻可进 EMERGENCY；SPEAKING 可被空格打断回 IDLE（INTERRUPT_L1）
 */
export const SessionState = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  THINKING: 'THINKING',
  SPEAKING: 'SPEAKING',
  EMERGENCY: 'EMERGENCY',
}

/** 状态对应的大字提示（适老化） */
export const STATUS_TEXT = {
  IDLE: '按空格键，直接说话就可以',
  LISTENING: '正在听… 说完停一下就好',
  THINKING: '我记一下…',
  SPEAKING: '按空格键可以打断我',
  EMERGENCY: '已进入紧急提示，请先拨打 120',
}

export const BADGE_TEXT = {
  IDLE: '待机',
  LISTENING: '正在听',
  THINKING: '思考中',
  SPEAKING: '正在回答',
  EMERGENCY: '紧急',
}

/** 允许的状态迁移（非法迁移直接忽略，避免乱跳） */
const TRANSITIONS = {
  IDLE: ['LISTENING', 'THINKING', 'SPEAKING', 'EMERGENCY'],
  LISTENING: ['THINKING', 'IDLE', 'EMERGENCY'],
  THINKING: ['SPEAKING', 'IDLE', 'EMERGENCY'],
  SPEAKING: ['IDLE', 'LISTENING', 'EMERGENCY'],
  EMERGENCY: ['IDLE'],
}

/**
 * 创建可变状态机实例（模块内用 ref 包一层即可）
 */
export function createSessionStateMachine(initial = SessionState.IDLE) {
  let state = initial

  return {
    get state() {
      return state
    },
    can(next) {
      return (TRANSITIONS[state] || []).includes(next)
    },
    /** @returns {boolean} 是否成功切换 */
    transition(next) {
      if (next === state) return true
      if (!this.can(next)) {
        console.warn('[session] 非法迁移', state, '->', next)
        return false
      }
      state = next
      return true
    },
    /** 强制进入紧急（可从任意态） */
    forceEmergency() {
      state = SessionState.EMERGENCY
    },
    reset() {
      state = SessionState.IDLE
    },
  }
}

/** 挂号流程步骤（对齐 S1–S7） */
export const FlowStep = {
  HOME: 'S1_HOME',
  BIND: 'S2_BIND',
  PATIENT: 'S3_PATIENT',
  TRIAGE: 'S4_TRIAGE',
  SLOTS: 'S5_SLOTS',
  CONFIRM: 'S6_CONFIRM',
  SUCCESS: 'S7_SUCCESS',
}
