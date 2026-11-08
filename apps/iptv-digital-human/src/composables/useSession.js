/**
 * 跨页面会话：对话状态机 + 挂号流程上下文
 * 挂在 App 层，通过 provide/inject 或直接在 App 内使用
 */
import { computed, reactive, ref } from 'vue'
import {
  BADGE_TEXT,
  createSessionStateMachine,
  FlowStep,
  SessionState,
  STATUS_TEXT,
} from '../core/sessionStateMachine.js'
import { Brain } from '../modules/ai/index.js'
import { createVoiceController } from '../modules/voice/index.js'
import { createSpeaker, createTypewriter } from '../modules/avatar/speak/index.js'
import registration from '../modules/registration/index.js'

export function useSession() {
  const sm = createSessionStateMachine()
  const dialogState = ref(sm.state)
  const flowStep = ref(FlowStep.HOME)

  const userLine = ref('')
  const botLine = ref('')
  const highlightIndex = ref(-1)
  const level = ref(0)
  const toast = reactive({ text: '', kind: 'warn', visible: false })
  let toastTimer = null

  const ctx = reactive({
    bindSession: null,
    patients: [],
    patient: null,
    symptom: '',
    triage: null,
    slots: [],
    selectedSlot: null,
    hold: null,
    order: null,
    holdDeadline: 0,
  })

  const brain = new Brain()
  const voice = createVoiceController()
  const speaker = createSpeaker()
  const typewriter = createTypewriter()

  // 数字人引擎实例由 AvatarHost 组件创建后注入
  let avatar = null
  function setAvatar(instance) {
    avatar = instance
  }

  const statusText = computed(() => STATUS_TEXT[dialogState.value] || '')
  const badgeText = computed(() => BADGE_TEXT[dialogState.value] || '')

  function syncState() {
    dialogState.value = sm.state
  }

  function showToast(msg, kind = 'warn', ms = 4800) {
    toast.text = msg
    toast.kind = kind
    toast.visible = true
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.visible = false
    }, ms)
  }

  function go(step) {
    flowStep.value = step
  }

  function interruptSpeaking() {
    brain.abort()
    speaker.stop()
    avatar?.stopSpeak()
    if (sm.state === SessionState.SPEAKING || sm.state === SessionState.THINKING) {
      sm.transition(SessionState.IDLE)
      syncState()
    }
  }

  /**
   * 半双工空格：IDLE 开始听；LISTENING 手动结束；SPEAKING 打断
   */
  async function onConfirmKey() {
    if (sm.state === SessionState.EMERGENCY) return
    if (sm.state === SessionState.SPEAKING || sm.state === SessionState.THINKING) {
      interruptSpeaking()
      showToast('已打断，您可以继续说', 'info')
      return
    }
    if (sm.state === SessionState.LISTENING) {
      voice.stop()
      return
    }
    if (sm.state === SessionState.IDLE) {
      startListening()
    }
  }

  function startListening() {
    if (!sm.transition(SessionState.LISTENING)) return
    syncState()
    userLine.value = ''
    avatar?.setEmotion('listen')
    voice.start((type, data) => {
      if (type === 'level') {
        level.value = data.value || 0
        return
      }
      if (type === 'partial') {
        userLine.value = data.text || ''
        return
      }
      if (type === 'final') {
        userLine.value = data.text || ''
        handleUserFinal(data.text || '')
        return
      }
      if (type === 'error') {
        sm.transition(SessionState.IDLE)
        syncState()
        avatar?.setEmotion('neutral')
        showToast(data.message || '语音出错')
        return
      }
      if (type === 'end') {
        if (sm.state === SessionState.LISTENING) {
          sm.transition(SessionState.IDLE)
          syncState()
          avatar?.setEmotion('neutral')
        }
        level.value = 0
      }
      if (type === 'thinking') {
        // 云端 ASR 上传中
        sm.transition(SessionState.THINKING)
        syncState()
      }
    })
  }

  /** 文字兜底：与语音 final 同一条链路 */
  function submitText(text) {
    const t = (text || '').trim()
    if (!t) return
    if (sm.state === SessionState.SPEAKING) interruptSpeaking()
    voice.abort()
    userLine.value = t
    handleUserFinal(t)
  }

  async function handleUserFinal(text) {
    const t = (text || '').trim()
    if (!t) {
      sm.transition(SessionState.IDLE)
      syncState()
      return
    }

    // 在导诊页时，把用户话记作症状线索
    if (flowStep.value === FlowStep.TRIAGE || flowStep.value === FlowStep.HOME) {
      ctx.symptom = t
    }

    sm.transition(SessionState.THINKING)
    syncState()
    avatar?.setEmotion('neutral')
    typewriter.reset()
    botLine.value = ''
    highlightIndex.value = -1

    let full = ''
    let emergency = false

    try {
      for await (const chunk of brain.ask(t)) {
        if (chunk.emergency) {
          emergency = true
          full = chunk.delta
          break
        }
        full = typewriter.append(chunk.delta)
        botLine.value = full
      }
    } catch (e) {
      console.error(e)
      showToast('回答生成失败')
      sm.transition(SessionState.IDLE)
      syncState()
      return
    }

    if (emergency) {
      enterEmergency(full)
      return
    }

    // 挂号意图且已有科室建议 → 可推进到选时段
    if (flowStep.value === FlowStep.TRIAGE) {
      const triage = registration.suggestDepartment(ctx.symptom || t)
      ctx.triage = triage
      // 若剧本已给出号源暗示，预拉 slots
      ctx.slots = await registration.listSlots({ department: triage.department })
    }

    await speakText(full)
  }

  async function speakText(text) {
    // 从 IDLE / THINKING 进入 SPEAKING
    if (sm.state !== SessionState.SPEAKING) {
      if (sm.state === SessionState.IDLE) sm.transition(SessionState.THINKING)
      sm.transition(SessionState.SPEAKING)
    }
    syncState()
    botLine.value = text
    avatar?.startSpeak()

    // Demo 默认 text 模式：字幕为主，嘴型跟字数节奏；TTS 可后续打开
    const useTts = false
    await new Promise((resolve) => {
      if (!useTts) {
        const len = Math.max(1, (text || '').length)
        const ms = Math.min(12000, Math.max(1800, len * 80))
        let i = 0
        const timer = setInterval(() => {
          // 若已被打断，停止打字机
          if (sm.state !== SessionState.SPEAKING) {
            clearInterval(timer)
            resolve()
            return
          }
          i += 1
          highlightIndex.value = Math.min(len - 1, i)
          if (i >= len) {
            clearInterval(timer)
            resolve()
          }
        }, Math.max(40, ms / len))
        return
      }
      speaker.speak(text, {
        onBoundary: (idx) => {
          highlightIndex.value = idx
        },
        onEnd: resolve,
      })
    })

    avatar?.stopSpeak()
    highlightIndex.value = -1
    if (sm.state === SessionState.SPEAKING) {
      sm.transition(SessionState.IDLE)
      syncState()
    }
  }

  function enterEmergency(text) {
    sm.forceEmergency()
    syncState()
    botLine.value = text || botLine.value
    avatar?.setEmotion('alert')
    avatar?.startSpeak()
    // 紧急态 Demo 允许 Esc 退出（方案说明）
  }

  function exitEmergency() {
    if (sm.state !== SessionState.EMERGENCY) return
    speaker.stop()
    avatar?.stopSpeak()
    avatar?.setEmotion('neutral')
    sm.transition(SessionState.IDLE)
    syncState()
  }

  return {
    dialogState,
    flowStep,
    FlowStep,
    SessionState,
    userLine,
    botLine,
    highlightIndex,
    level,
    toast,
    ctx,
    statusText,
    badgeText,
    showToast,
    go,
    onConfirmKey,
    startListening,
    submitText,
    interruptSpeaking,
    enterEmergency,
    exitEmergency,
    speakText,
    setAvatar,
    speaker,
    registration,
    brain,
  }
}
