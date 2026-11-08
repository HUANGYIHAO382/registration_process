/**
 * 语音模块出口
 * 上层只通过 createVoiceSession / VoiceInput 交互，不直接碰 MediaStream
 *
 * 关键约定（方案 02）：
 * - abort() 不产生 final
 * - 每次 start 分配 listenId，过期的 final 丢弃
 */
import { VoiceInput } from './VoiceInput.js'
import { asrIdToChannel, getProviderState } from '../api-switch/index.js'

export { VoiceInput }

const DEFAULT_MOCK_LINES = [
  '我这两天血压有点高，头晕',
  '我想挂心血管内科',
  '帮我预约明天下午',
  '我胸口有点闷，但还能说话',
]

/**
 * 创建一个带 listenId 保护的语音会话工厂
 */
export function createVoiceController(options = {}) {
  const mockLines = options.mockLines || DEFAULT_MOCK_LINES
  let listenId = 0
  let current = null

  function nextListenId() {
    listenId += 1
    return listenId
  }

  /**
   * 开始听一轮
   * @param {(type: string, data: object) => void} onEvent
   */
  function start(onEvent) {
    // 新一轮开始前，丢掉上一轮
    if (current) {
      try {
        current.abort()
      } catch {
        /* ignore */
      }
      current = null
    }

    const id = nextListenId()
    const channel = asrIdToChannel(getProviderState().asr.activeId)

    const voice = new VoiceInput({
      channel,
      mockLines,
      onEvent: (type, data = {}) => {
        // 过期 listenId 的回调一律丢弃，避免打断后旧 final 污染会话
        if (id !== listenId && type !== 'end') return
        onEvent(type, { ...data, listenId: id, channel })
      },
    })
    current = voice
    voice.start()
    return { listenId: id, channel }
  }

  function stop() {
    current?.stop()
  }

  function abort() {
    listenId += 1 // 使进行中的回调全部失效
    current?.abort()
    current = null
  }

  return { start, stop, abort, getListenId: () => listenId }
}
