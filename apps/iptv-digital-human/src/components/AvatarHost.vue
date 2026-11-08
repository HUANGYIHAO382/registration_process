<script setup>
/**
 * 数字人挂载点：默认加载高清精灵图「安安」
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createAvatar, AVATAR_IDENTITY } from '../modules/avatar/index.js'

defineProps({
  // 预留：以后可从设置切换 pack
  packId: { type: String, default: AVATAR_IDENTITY.packId },
})
const emit = defineEmits(['ready'])

const host = ref(null)
const displayName = AVATAR_IDENTITY.displayName
let avatar = null

onMounted(() => {
  if (!host.value) return
  avatar = createAvatar(host.value, {
    engine: AVATAR_IDENTITY.engine,
    packId: AVATAR_IDENTITY.packId,
  })
  // 精灵引擎创建即 idle；补一次中性情绪
  avatar.setEmotion?.('neutral')
  emit('ready', avatar)
})

onBeforeUnmount(() => {
  avatar?.destroy()
  avatar = null
})
</script>

<template>
  <div class="avatar-wrap">
    <div ref="host" class="avatar-host" :aria-label="'数字人' + displayName"></div>
    <div class="name-tag">{{ displayName }}</div>
  </div>
</template>

<style scoped>
.avatar-wrap {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

/* 精灵图舞台略抬高，更贴大屏左侧构图 */
.avatar-host {
  width: 560px;
  height: 780px;
  flex: 0 0 auto;
}
</style>
