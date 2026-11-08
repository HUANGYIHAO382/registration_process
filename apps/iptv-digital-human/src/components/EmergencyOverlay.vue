<script setup>
/**
 * 危急红屏：大字 120；Demo 可用 Esc 退出
 */
defineProps({
  visible: { type: Boolean, default: false },
})
</script>

<template>
  <div v-if="visible" class="emergency" role="alert">
    <div class="emergency-inner">
      <p class="code">120</p>
      <p class="msg">请立即拨打急救电话，或让家人帮忙拨打</p>
      <p class="hint">演示模式：按 Esc 可退出紧急提示</p>
    </div>
  </div>
</template>

<style scoped>
.emergency {
  position: absolute;
  inset: 0;
  z-index: 40;
  background: rgba(90, 12, 8, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
}
.emergency-inner {
  text-align: center;
  padding: 48px;
}
.code {
  margin: 0;
  font-size: 180px;
  font-weight: 700;
  letter-spacing: 12px;
  color: #fff;
  line-height: 1;
}
.msg {
  margin: 24px 0 12px;
  font-size: 40px;
  color: #ffe8e4;
}
.hint {
  margin: 0;
  font-size: 22px;
  color: rgba(255, 232, 228, 0.65);
}
</style>
