<script setup>
defineProps({
  visible: Boolean,
  text: String,
  kind: { type: String, default: 'warn' },
})
</script>

<template>
  <div class="toast" :class="[{ show: visible }, kind]">{{ text }}</div>
</template>

<style scoped>
.toast {
  position: absolute;
  left: 50%;
  bottom: 120px;
  transform: translateX(-50%) translateY(12px);
  z-index: 30;
  min-width: 320px;
  max-width: 920px;
  padding: 18px 28px;
  border-radius: 14px;
  background: rgba(40, 18, 12, 0.92);
  border: 1px solid rgba(224, 83, 61, 0.55);
  color: #ffe8e4;
  font-size: 26px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.24s, transform 0.24s;
  text-align: center;
}
.toast.info {
  background: rgba(12, 40, 34, 0.92);
  border-color: rgba(18, 179, 155, 0.45);
  color: var(--ink);
}
.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
