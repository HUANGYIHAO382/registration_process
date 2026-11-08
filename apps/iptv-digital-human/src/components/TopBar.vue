<script setup>
/**
 * 顶栏：品牌 + 状态徽章 + 打开设置
 */
import { AVATAR_IDENTITY } from '../modules/avatar/index.js'

defineProps({
  badgeText: { type: String, default: '待机' },
  dialogState: { type: String, default: 'IDLE' },
  scaleLabel: { type: String, default: '' },
})

const brandLine = '龙华人民医院 · ' + AVATAR_IDENTITY.brandSuffix
const emit = defineEmits(['open-settings'])
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <span class="brand-dot" aria-hidden="true"></span>
      <span>{{ brandLine }}</span>
    </div>
    <div class="top-right">
      <span v-if="scaleLabel" class="scale-chip">画幅 {{ scaleLabel }}</span>
      <span class="badge" :data-s="dialogState">{{ badgeText }}</span>
      <button class="btn-ghost settings-btn" type="button" @click="emit('open-settings')">
        设置
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 96px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 64px;
  border-bottom: 1px solid rgba(34, 66, 58, 0.55);
}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 30px;
  font-weight: 500;
  color: var(--ink2);
}

.brand-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--teal);
  box-shadow: 0 0 0 6px rgba(18, 179, 155, 0.16);
}

.top-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.badge {
  min-width: 120px;
  text-align: center;
  padding: 10px 18px;
  border-radius: 999px;
  background: var(--panel);
  border: 1px solid var(--line);
  font-size: 22px;
}

.badge[data-s='LISTENING'] {
  border-color: var(--teal);
  color: var(--teal);
}
.badge[data-s='SPEAKING'] {
  border-color: var(--amber);
  color: var(--amber);
}
.badge[data-s='EMERGENCY'] {
  border-color: var(--warn);
  color: var(--warn);
  background: rgba(224, 83, 61, 0.12);
}

.scale-chip {
  font-size: 18px;
  color: var(--muted);
}

.settings-btn {
  min-height: 52px;
  font-size: 22px;
}
</style>
