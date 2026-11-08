<script setup>
/**
 * 简易波形：根据语音 level 驱动竖条高度
 */
import { onMounted, onUnmounted, reactive, watch } from 'vue'

const props = defineProps({
  active: { type: Boolean, default: false },
  level: { type: Number, default: 0 },
})

const BAR_COUNT = 9
const bars = reactive(Array.from({ length: BAR_COUNT }, () => ({ v: 0 })))
let raf = 0

function tick() {
  bars.forEach((b, i) => {
    const center = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2)
    const jitter = props.active ? 0.65 + Math.random() * 0.7 : 0
    const target = props.active ? props.level * (0.35 + center * 1.15) * jitter : 0
    b.v += (target - b.v) * 0.42
  })
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  raf = requestAnimationFrame(tick)
})
onUnmounted(() => cancelAnimationFrame(raf))

watch(
  () => props.active,
  () => {
    /* 仅驱动 class，动画在 tick 里 */
  }
)
</script>

<template>
  <div class="wave" :class="{ active }">
    <i
      v-for="(b, i) in bars"
      :key="i"
      :style="{ transform: `scaleY(${(0.12 + b.v * 1.08).toFixed(2)})` }"
    ></i>
  </div>
</template>

<style scoped>
.wave {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 8px;
  height: 48px;
  opacity: 0.45;
}
.wave.active {
  opacity: 1;
}
.wave i {
  display: block;
  width: 8px;
  height: 40px;
  border-radius: 4px;
  background: var(--teal);
  transform-origin: bottom center;
}
</style>
