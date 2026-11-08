/**
 * 舞台缩放：设计稿固定 1920×1080，用 transform scale 控制显示大小
 * 模式：
 *   fit  —— 按窗口等比缩小/放大，完整可见（默认，IPTV 推荐）
 *   100% —— 1:1 像素，窗口不够则滚动
 *   custom —— 手动倍率（如 0.5 / 0.75 / 1.25）
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'

const DESIGN_W = 1920
const DESIGN_H = 1080

export function useStageScale() {
  // fit | exact | custom
  const mode = ref('fit')
  // 自定义倍率，仅 mode=custom 时生效
  const customScale = ref(0.75)
  const windowW = ref(typeof window !== 'undefined' ? window.innerWidth : DESIGN_W)
  const windowH = ref(typeof window !== 'undefined' ? window.innerHeight : DESIGN_H)

  function onResize() {
    windowW.value = window.innerWidth
    windowH.value = window.innerHeight
  }

  onMounted(() => {
    onResize()
    window.addEventListener('resize', onResize)
  })
  onUnmounted(() => window.removeEventListener('resize', onResize))

  const scale = computed(() => {
    if (mode.value === 'exact') return 1
    if (mode.value === 'custom') return Number(customScale.value) || 1
    // fit：contain，两边留黑边
    return Math.min(windowW.value / DESIGN_W, windowH.value / DESIGN_H)
  })

  // 绝对定位时的居中偏移（fit / custom 时居中；exact 从左上角开始，便于滚动查看）
  const offset = computed(() => {
    const s = scale.value
    if (mode.value === 'exact') {
      return { left: 0, top: 0 }
    }
    return {
      left: (windowW.value - DESIGN_W * s) / 2,
      top: (windowH.value - DESIGN_H * s) / 2,
    }
  })

  const stageStyle = computed(() => ({
    transform: `scale(${scale.value})`,
    left: `${offset.value.left}px`,
    top: `${offset.value.top}px`,
  }))

  function setMode(next) {
    mode.value = next
  }

  function setCustomScale(v) {
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) return
    // 限制在合理范围，避免缩成一点或过大卡死
    customScale.value = Math.min(2, Math.max(0.25, n))
    mode.value = 'custom'
  }

  return {
    DESIGN_W,
    DESIGN_H,
    mode,
    customScale,
    scale,
    stageStyle,
    setMode,
    setCustomScale,
  }
}
