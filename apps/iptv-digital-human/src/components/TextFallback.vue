<script setup>
/**
 * 文字兜底输入：链路与语音 final 相同
 */
import { ref } from 'vue'

const emit = defineEmits(['submit'])
const text = ref('')

function send() {
  const t = text.value.trim()
  if (!t) return
  emit('submit', t)
  text.value = ''
}
</script>

<template>
  <form class="fallback" @submit.prevent="send">
    <input
      v-model="text"
      class="fallback-input"
      type="text"
      placeholder="说不清楚时，可以在这里打字，回车发送"
      maxlength="120"
    />
    <button class="btn-primary send" type="submit">发送</button>
  </form>
</template>

<style scoped>
.fallback {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 0 64px 28px;
  flex: 0 0 auto;
}
.fallback-input {
  flex: 1;
  height: 64px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: rgba(8, 17, 16, 0.55);
  padding: 0 20px;
  font-size: 24px;
  outline: none;
}
.fallback-input:focus {
  border-color: var(--teal);
}
.send {
  min-height: 64px;
  font-size: 24px;
  padding: 0 28px;
}
</style>
