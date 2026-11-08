<script setup>
/**
 * S1 首页：看病挂号入口
 */
import { AVATAR_IDENTITY } from '../modules/avatar/index.js'

const emit = defineEmits(['start-register', 'start-chat'])
const hello = `您好，我是${AVATAR_IDENTITY.displayName}`
</script>

<template>
  <div class="panel home">
    <h1 class="hero-title">{{ hello }}</h1>
    <p class="body-text muted">可以说「我要挂号」，或按下面的按钮开始。</p>
    <div class="actions">
      <button class="btn-primary focusable" type="button" @click="emit('start-register')">
        看病挂号
      </button>
      <button class="btn-ghost focusable" type="button" @click="emit('start-chat')">
        先问问健康事
      </button>
    </div>
    <p class="tip muted">提示：按空格键开始说话；说话时再按空格可打断我。</p>
  </div>
</template>

<style scoped>
.home {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.actions {
  display: flex;
  gap: 20px;
  margin: 36px 0 24px;
  flex-wrap: wrap;
}
.tip {
  font-size: 22px;
  margin: 0;
}
</style>
