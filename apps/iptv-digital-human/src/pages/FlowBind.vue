<script setup>
/**
 * S2 绑定：按实验流 A/B/C 展示不同话术；可一键模拟手机确认
 */
import { computed, onMounted, ref } from 'vue'
import { getProviderState } from '../modules/api-switch/index.js'
import registration from '../modules/registration/index.js'

const emit = defineEmits(['bound', 'back', 'toast'])

const variant = computed(() => getProviderState().bind.activeVariant)
const consentOk = ref(registration.getConsentState().privacyAccepted)
const loading = ref(false)
const session = ref(null)
const error = ref('')

const copy = computed(() => {
  if (variant.value === 'B') {
    return {
      title: '先了解情况，再绑定账户',
      body: '流 B：您可以先说说哪里不舒服；正式挂号前再完成绑定。本页仍可演示出码。',
    }
  }
  if (variant.value === 'C') {
    return {
      title: '家人可以帮您完成绑定',
      body: '流 C：请家人用手机扫码或输入电视上的 6 位码，帮您登录家庭账户。',
    }
  }
  return {
    title: '第一次使用，先绑定账户',
    body: '流 A：请用手机扫描下方二维码示意区，或输入 6 位绑定码。',
  }
})

function accept() {
  registration.acceptPrivacy()
  consentOk.value = true
}

async function createCode() {
  error.value = ''
  loading.value = true
  try {
    if (!consentOk.value) accept()
    session.value = await registration.createBindSession()
  } catch (e) {
    error.value = e.message || '出码失败'
    emit('toast', error.value)
  } finally {
    loading.value = false
  }
}

async function mockPhoneOk() {
  if (!session.value) {
    await createCode()
  }
  if (!session.value) return
  loading.value = true
  try {
    await registration.mockConfirmBind(session.value.sessionId, session.value.code)
    emit('bound', session.value)
  } catch (e) {
    error.value = e.message || '确认失败'
    emit('toast', error.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // 进入页时若已同意隐私，可自动出码；否则等用户勾选
})
</script>

<template>
  <div class="panel bind">
    <h2 class="section-title">{{ copy.title }}</h2>
    <p class="body-text">{{ copy.body }}</p>

    <label class="consent">
      <input v-model="consentOk" type="checkbox" @change="consentOk && accept()" />
      <span>我已阅读隐私说明：对话用于导诊挂号演示，证件号会脱敏显示。</span>
    </label>

    <div class="code-box">
      <div class="qr-fake" aria-hidden="true">QR</div>
      <div class="code-side">
        <p class="muted">6 位绑定码</p>
        <p class="code">{{ session?.code || '------' }}</p>
        <p v-if="session?.expiresInSec" class="muted small">约 {{ session.expiresInSec }} 秒内有效</p>
      </div>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <div class="actions">
      <button class="btn-ghost" type="button" :disabled="loading" @click="emit('back')">返回</button>
      <button class="btn-ghost" type="button" :disabled="loading || !consentOk" @click="createCode">
        刷新绑定码
      </button>
      <button class="btn-primary" type="button" :disabled="loading || !consentOk" @click="mockPhoneOk">
        模拟手机已确认
      </button>
    </div>
  </div>
</template>

<style scoped>
.bind {
  flex: 1;
}
.consent {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin: 24px 0;
  font-size: 24px;
  line-height: 1.4;
}
.consent input {
  width: 28px;
  height: 28px;
  margin-top: 4px;
}
.code-box {
  display: flex;
  gap: 28px;
  align-items: center;
  margin: 12px 0 28px;
}
.qr-fake {
  width: 200px;
  height: 200px;
  border-radius: 16px;
  border: 2px dashed var(--teal);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: var(--teal);
  background: rgba(18, 179, 155, 0.08);
}
.code {
  margin: 8px 0;
  font-size: 64px;
  letter-spacing: 10px;
  font-weight: 700;
  color: var(--teal);
}
.small {
  font-size: 20px;
}
.actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.err {
  color: var(--warn);
  font-size: 24px;
}
</style>
