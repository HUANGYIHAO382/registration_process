<script setup>
/**
 * S4 导诊对话区：字幕 + 状态 + 进入选号
 */
import WaveBars from '../components/WaveBars.vue'
import { AVATAR_IDENTITY } from '../modules/avatar/index.js'

const speakerLabel = AVATAR_IDENTITY.displayName

defineProps({
  statusText: String,
  userLine: String,
  botLine: String,
  highlightIndex: { type: Number, default: -1 },
  level: { type: Number, default: 0 },
  listening: Boolean,
  triage: Object,
  patientName: String,
})
const emit = defineEmits(['to-slots', 'back'])

/** 把字幕拆成字符，便于高亮「正在读」的位置 */
function chars(text) {
  return Array.from(text || '')
}
</script>

<template>
  <div class="panel triage">
    <div class="head-row">
      <h2 class="section-title">跟我说哪里不舒服</h2>
      <span v-if="patientName" class="who">就诊人：{{ patientName }}</span>
    </div>
    <p class="status">{{ statusText }}</p>
    <WaveBars :active="listening" :level="level" />

    <div class="lines">
      <p class="user">
        <span class="label">您：</span>{{ userLine || '（等待您说话）' }}
      </p>
      <p class="bot" aria-live="polite">
        <span class="label">{{ speakerLabel }}：</span>
        <span
          v-for="(ch, i) in chars(botLine)"
          :key="i"
          class="ch"
          :class="{ hi: i === highlightIndex }"
          >{{ ch }}</span
        >
        <span v-if="!botLine" class="muted">（我在这儿）</span>
      </p>
    </div>

    <div v-if="triage" class="triage-card">
      <p class="body-text">建议科室：{{ triage.department }}</p>
      <p class="muted reason">{{ triage.reason }}</p>
      <button class="btn-primary" type="button" @click="emit('to-slots')">查看可约时段</button>
    </div>

    <button class="btn-ghost back" type="button" @click="emit('back')">返回</button>
  </div>
</template>

<style scoped>
.triage {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.head-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}
.who {
  font-size: 22px;
  color: var(--ink2);
}
.status {
  font-size: 28px;
  color: var(--ink2);
  margin: 8px 0 16px;
}
.lines {
  margin-top: 20px;
  flex: 1;
  overflow: auto;
}
.user,
.bot {
  font-size: 32px;
  line-height: 1.55;
  margin: 0 0 18px;
}
.label {
  color: var(--teal);
  margin-right: 8px;
}
.ch.hi {
  background: rgba(240, 184, 96, 0.35);
  border-radius: 4px;
}
.triage-card {
  margin-top: 12px;
  padding: 20px 24px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: rgba(18, 179, 155, 0.08);
}
.reason {
  font-size: 22px;
  margin: 8px 0 16px;
}
.back {
  margin-top: 16px;
  align-self: flex-start;
}
</style>
