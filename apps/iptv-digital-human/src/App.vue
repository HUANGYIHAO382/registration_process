<script setup>
/**
 * 根组件：1920×1080 舞台 + 会话编排 + S1–S7 视图切换
 */
import { computed, onMounted, ref } from 'vue'
import { useStageScale } from './composables/useStageScale.js'
import { useRemoteKeys } from './composables/useRemoteKeys.js'
import { useSession } from './composables/useSession.js'
import { activateAsr, loadProviderConfig, getProviderState } from './modules/api-switch/index.js'
import { FlowStep } from './core/sessionStateMachine.js'

import TopBar from './components/TopBar.vue'
import AvatarHost from './components/AvatarHost.vue'
import EmergencyOverlay from './components/EmergencyOverlay.vue'
import ToastBar from './components/ToastBar.vue'
import TextFallback from './components/TextFallback.vue'
import SettingsPanel from './components/SettingsPanel.vue'

import FlowHome from './pages/FlowHome.vue'
import FlowBind from './pages/FlowBind.vue'
import FlowPatient from './pages/FlowPatient.vue'
import FlowTriage from './pages/FlowTriage.vue'
import FlowSlots from './pages/FlowSlots.vue'
import FlowConfirm from './pages/FlowConfirm.vue'
import FlowSuccess from './pages/FlowSuccess.vue'

const {
  mode: scaleMode,
  customScale,
  scale,
  stageStyle,
  setMode,
  setCustomScale,
} = useStageScale()

// 解构后，模板里可直接用 dialogState，无需 .value
const {
  dialogState,
  flowStep,
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
  submitText,
  exitEmergency,
  speakText,
  setAvatar,
  speaker,
  registration,
} = useSession()

const settingsOpen = ref(false)
const holding = ref(false)
const patientRef = ref(null)
const slotsRef = ref(null)

const scaleLabel = computed(() => {
  const pct = Math.round(scale.value * 100) + '%'
  if (scaleMode.value === 'fit') return `自适应 ${pct}`
  if (scaleMode.value === 'exact') return '100%'
  return `自定义 ${pct}`
})

onMounted(async () => {
  speaker.init()
  await loadProviderConfig()
})

useRemoteKeys((action) => {
  if (action === 'escape') {
    if (settingsOpen.value) {
      settingsOpen.value = false
      return
    }
    if (dialogState.value === SessionState.EMERGENCY) {
      exitEmergency()
      return
    }
  }

  if (flowStep.value === FlowStep.PATIENT) {
    if (action === 'up') patientRef.value?.move(-1)
    if (action === 'down') patientRef.value?.move(1)
    if (action === 'confirm') {
      patientRef.value?.confirm()
      return
    }
  }
  if (flowStep.value === FlowStep.SLOTS) {
    if (action === 'up') slotsRef.value?.move(-1)
    if (action === 'down') slotsRef.value?.move(1)
    if (action === 'confirm') {
      slotsRef.value?.confirm()
      return
    }
  }

  if (action === 'confirm') {
    onConfirmKey()
  }

  if (action === 'digit:1') activateAsr('asr.browser')
  if (action === 'digit:2') activateAsr('asr.cloud')
  if (action === 'digit:3') activateAsr('asr.mock')
})

function onAvatarReady(avatar) {
  setAvatar(avatar)
}

/** 开始挂号：按实验流决定先绑还是先聊 */
function startRegister() {
  const v = getProviderState().bind.activeVariant
  if (v === 'B' && registration.getDeviceToken()) {
    go(FlowStep.PATIENT)
    return
  }
  if (v === 'B') {
    ctx.patient = { id: 'guest', name: '访客（稍后绑定）', idCardMasked: '****' }
    go(FlowStep.TRIAGE)
    speakText('好，您先说说哪里不舒服。正式挂号前我们再绑定账户。')
    return
  }
  if (registration.getDeviceToken()) {
    go(FlowStep.PATIENT)
  } else {
    go(FlowStep.BIND)
  }
}

function startChatOnly() {
  go(FlowStep.TRIAGE)
  speakText('好的，您想问什么，慢慢说。')
}

async function onBound() {
  showToast('绑定成功', 'info')
  go(FlowStep.PATIENT)
}

function onSelectPatient(p) {
  ctx.patient = p
  go(FlowStep.TRIAGE)
  speakText(`好的，这次帮${p.name}挂号。您说说哪里不舒服。`)
}

async function toSlots() {
  if (!ctx.triage) {
    ctx.triage = registration.suggestDepartment(ctx.symptom || userLine.value)
  }
  if (ctx.patient?.id === 'guest' && !registration.getDeviceToken()) {
    showToast('正式预约前需要先绑定账户')
    go(FlowStep.BIND)
    return
  }
  ctx.slots = await registration.listSlots({
    department: ctx.triage.department,
  })
  go(FlowStep.SLOTS)
}

async function onSelectSlot(slot) {
  ctx.selectedSlot = slot
  holding.value = true
  try {
    ctx.hold = await registration.holdSlot({
      slotId: slot.slotId,
      patientId: ctx.patient?.id,
      department: ctx.triage?.department,
      idempotencyKey: `hold_${slot.slotId}_${Date.now()}`,
    })
    go(FlowStep.CONFIRM)
  } catch (e) {
    showToast(e.message || '预占失败')
  } finally {
    holding.value = false
  }
}

async function rehold() {
  if (!ctx.selectedSlot) return
  await onSelectSlot(ctx.selectedSlot)
}

async function onConfirmOrder() {
  holding.value = true
  try {
    const order = await registration.confirmOrder({
      holdId: ctx.hold.holdId,
      idempotencyKey: `confirm_${ctx.hold.holdId}_${Date.now()}`,
    })
    ctx.order = {
      ...order,
      department: ctx.triage?.department,
      slotLabel: ctx.selectedSlot?.label,
      doctorName: ctx.selectedSlot?.doctorName,
    }
    go(FlowStep.SUCCESS)
    speakText('预约已经成功。请到医院再缴费取号。')
  } catch (e) {
    showToast(e.message || '确认失败')
  } finally {
    holding.value = false
  }
}

function goHome() {
  ctx.hold = null
  ctx.order = null
  ctx.selectedSlot = null
  ctx.triage = null
  go(FlowStep.HOME)
}
</script>

<template>
  <div class="viewport">
    <div class="stage" :style="stageStyle">
      <TopBar
        :badge-text="badgeText"
        :dialog-state="dialogState"
        :scale-label="scaleLabel"
        @open-settings="settingsOpen = true"
      />

      <div class="stage-main">
        <section class="stage-left">
          <AvatarHost @ready="onAvatarReady" />
        </section>

        <section class="stage-right">
          <FlowHome
            v-if="flowStep === FlowStep.HOME"
            @start-register="startRegister"
            @start-chat="startChatOnly"
          />
          <FlowBind
            v-else-if="flowStep === FlowStep.BIND"
            @bound="onBound"
            @back="go(FlowStep.HOME)"
            @toast="(m) => showToast(m)"
          />
          <FlowPatient
            v-else-if="flowStep === FlowStep.PATIENT"
            ref="patientRef"
            @select="onSelectPatient"
            @back="go(FlowStep.HOME)"
            @toast="(m) => showToast(m)"
          />
          <FlowTriage
            v-else-if="flowStep === FlowStep.TRIAGE"
            :status-text="statusText"
            :user-line="userLine"
            :bot-line="botLine"
            :highlight-index="highlightIndex"
            :level="level"
            :listening="dialogState === SessionState.LISTENING"
            :triage="ctx.triage"
            :patient-name="ctx.patient?.name"
            @to-slots="toSlots"
            @back="go(FlowStep.HOME)"
          />
          <FlowSlots
            v-else-if="flowStep === FlowStep.SLOTS"
            ref="slotsRef"
            :slots="ctx.slots"
            :department="ctx.triage?.department"
            @select="onSelectSlot"
            @back="go(FlowStep.TRIAGE)"
          />
          <FlowConfirm
            v-else-if="flowStep === FlowStep.CONFIRM"
            :patient="ctx.patient"
            :slot="ctx.selectedSlot"
            :department="ctx.triage?.department"
            :hold="ctx.hold"
            :holding="holding"
            @confirm="onConfirmOrder"
            @rehold="rehold"
            @back="go(FlowStep.SLOTS)"
          />
          <FlowSuccess
            v-else-if="flowStep === FlowStep.SUCCESS"
            :order="ctx.order"
            :patient-name="ctx.patient?.name"
            @home="goHome"
          />
        </section>
      </div>

      <TextFallback @submit="submitText" />

      <EmergencyOverlay :visible="dialogState === SessionState.EMERGENCY" />
      <ToastBar :visible="toast.visible" :text="toast.text" :kind="toast.kind" />
      <SettingsPanel
        :open="settingsOpen"
        :scale-mode="scaleMode"
        :custom-scale="customScale"
        :scale-value="scale"
        @close="settingsOpen = false"
        @set-scale-mode="setMode"
        @set-custom-scale="setCustomScale"
      />
    </div>
  </div>
</template>
