<script setup>
/**
 * S6 确认页：不展示完整证件号；提示到院缴费；预占倒计时
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  patient: Object,
  slot: Object,
  department: String,
  hold: Object,
  holding: Boolean,
})
const emit = defineEmits(['confirm', 'back', 'rehold'])

const now = ref(Date.now())
let timer = 0

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 500)
})
onUnmounted(() => clearInterval(timer))

const remainSec = computed(() => {
  if (!props.hold?.expiresAt) return 0
  return Math.max(0, Math.floor((props.hold.expiresAt - now.value) / 1000))
})

const expired = computed(() => props.hold && remainSec.value <= 0)
</script>

<template>
  <div class="panel">
    <h2 class="section-title">请确认预约信息</h2>
    <dl class="dl">
      <div><dt>就诊人</dt><dd>{{ patient?.name }}（{{ patient?.idCardMasked }}）</dd></div>
      <div><dt>科室</dt><dd>{{ department }}</dd></div>
      <div><dt>时间</dt><dd>{{ slot?.label }}</dd></div>
      <div><dt>医生</dt><dd>{{ slot?.doctorName }} · {{ slot?.clinicType }}</dd></div>
    </dl>

    <p class="pay">费用说明：电视只完成预约，挂号费请到医院窗口 / 自助机 / 医院官方渠道缴纳（到院付）。</p>

    <p v-if="hold && !expired" class="hold">号源已预留，剩余 {{ remainSec }} 秒，请尽快确认</p>
    <p v-else-if="expired" class="hold warn">预留已过期，请重新锁定号源</p>

    <div class="actions">
      <button class="btn-ghost" type="button" @click="emit('back')">返回</button>
      <button v-if="expired" class="btn-ghost" type="button" :disabled="holding" @click="emit('rehold')">
        重新预留
      </button>
      <button
        class="btn-primary"
        type="button"
        :disabled="holding || !hold || expired"
        @click="emit('confirm')"
      >
        {{ holding ? '提交中…' : '确认预约' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.dl {
  margin: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dl > div {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 12px;
  font-size: 30px;
}
dt {
  color: var(--muted);
}
dd {
  margin: 0;
  font-weight: 600;
}
.pay {
  font-size: 24px;
  line-height: 1.45;
  color: var(--amber);
  margin: 8px 0 20px;
}
.hold {
  font-size: 26px;
  color: var(--teal);
}
.hold.warn {
  color: var(--warn);
}
.actions {
  display: flex;
  gap: 16px;
  margin-top: 28px;
  flex-wrap: wrap;
}
</style>
