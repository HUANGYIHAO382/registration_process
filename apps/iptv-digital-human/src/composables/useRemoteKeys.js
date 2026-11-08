/**
 * 遥控器 / 键盘映射层
 * 页面不要直接写 keyCode，统一从这里订阅，方便以后换成机顶盒键值
 */
import { onMounted, onUnmounted } from 'vue'

/** 把浏览器键盘事件映射成语义动作 */
export function mapKeyToAction(e) {
  const key = e.key
  if (key === ' ' || key === 'Enter') return 'confirm'
  if (key === 'Escape') return 'escape'
  if (key === 'ArrowUp') return 'up'
  if (key === 'ArrowDown') return 'down'
  if (key === 'ArrowLeft') return 'left'
  if (key === 'ArrowRight') return 'right'
  if (key === 'Backspace') return 'back'
  // 数字键：通道/选项快捷键
  if (/^[0-9]$/.test(key)) return `digit:${key}`
  return null
}

/**
 * @param {(action: string, e: KeyboardEvent) => void} handler
 * @param {{ ignoreWhenTyping?: boolean }} options
 */
export function useRemoteKeys(handler, options = {}) {
  const ignoreWhenTyping = options.ignoreWhenTyping !== false

  function onKeyDown(e) {
    // 输入框打字时，不抢空格/方向键（文字兜底框需要）
    if (ignoreWhenTyping) {
      const tag = (e.target && e.target.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
        return
      }
    }
    const action = mapKeyToAction(e)
    if (!action) return
    // 空格默认会滚动页面，大屏演示时禁止
    if (action === 'confirm') e.preventDefault()
    handler(action, e)
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
}
