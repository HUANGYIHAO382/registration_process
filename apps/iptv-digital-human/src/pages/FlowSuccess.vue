<script setup>
/**
 * S7 成功凭证
 */
defineProps({
  order: Object,
  patientName: String,
})
const emit = defineEmits(['home'])
</script>

<template>
  <div class="panel success">
    <h2 class="section-title">预约成功</h2>
    <p class="ticket">取号凭证 {{ order?.ticketNo || '—' }}</p>
    <p class="body-text">就诊人：{{ patientName }}</p>
    <p class="body-text">{{ order?.department }} · {{ order?.slotLabel }}</p>
    <p class="body-text muted">{{ order?.doctorName }}</p>
    <p class="pay">请到院后按医院指引缴费取号，无需在电视上支付。</p>
    <button class="btn-primary" type="button" @click="emit('home')">回到首页</button>
  </div>
</template>

<style scoped>
.success {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
}
.ticket {
  font-size: 56px;
  font-weight: 700;
  color: var(--teal);
  margin: 8px 0 20px;
}
.pay {
  font-size: 26px;
  color: var(--amber);
  margin: 12px 0 32px;
  max-width: 900px;
  line-height: 1.45;
}
</style>
