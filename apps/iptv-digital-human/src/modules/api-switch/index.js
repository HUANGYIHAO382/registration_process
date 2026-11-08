/**
 * API 切换模块（ProviderRegistry）
 * 业务模块只认「当前激活的 provider id」，不写死厂商 URL / Key
 */
import { reactive, readonly } from 'vue'

const state = reactive({
  loaded: false,
  asr: { activeId: 'asr.mock', providers: [] },
  llm: { activeId: 'llm.script', providers: [] },
  tts: { activeId: 'tts.browser', rate: 0.88 },
  bind: { activeVariant: 'A', variants: ['A', 'B', 'C'] },
  params: { asr: { language: 'zh-CN', lowConfidence: 0.6 } },
})

/** 前端本地注册表：展示名与通道能力（是否真请求后端） */
const LOCAL_ASR = [
  { id: 'asr.browser', label: '浏览器识别', needsCloud: false },
  { id: 'asr.cloud', label: '云端 ASR', needsCloud: true },
  { id: 'asr.mock', label: '演示剧本', needsCloud: false },
]

const LOCAL_LLM = [
  { id: 'llm.script', label: '本地剧本', needsCloud: false },
  { id: 'llm.cloud', label: '云端大模型', needsCloud: true },
]

/**
 * 从服务端拉配置（不含 Key），合并本地注册表
 */
export async function loadProviderConfig() {
  try {
    const res = await fetch('/api/config')
    if (!res.ok) throw new Error('config http ' + res.status)
    const data = await res.json()

    // ASR：云端是否可用取决于服务端 enabled
    const asrCloudOk = !!data.asr?.enabled
    state.asr.providers = LOCAL_ASR.map((p) => ({
      ...p,
      enabled: p.id === 'asr.cloud' ? asrCloudOk : true,
    }))
    // 若云端不可用且当前选了云端，降级到 browser
    if (data.asr?.activeId) state.asr.activeId = data.asr.activeId
    if (state.asr.activeId === 'asr.cloud' && !asrCloudOk) {
      state.asr.activeId = 'asr.browser'
    }

    const llmCloudOk = !!data.llm?.enabled
    state.llm.providers = LOCAL_LLM.map((p) => ({
      ...p,
      enabled: p.id === 'llm.cloud' ? llmCloudOk : true,
    }))
    if (data.llm?.activeId) state.llm.activeId = data.llm.activeId
    if (state.llm.activeId === 'llm.cloud' && !llmCloudOk) {
      state.llm.activeId = 'llm.script'
    }

    if (data.tts?.rate != null) state.tts.rate = data.tts.rate
    if (data.bind?.activeVariant) state.bind.activeVariant = data.bind.activeVariant
    if (Array.isArray(data.bind?.variants)) state.bind.variants = data.bind.variants
    if (data.params) state.params = { ...state.params, ...data.params }
  } catch (e) {
    console.warn('[api-switch] 拉取配置失败，使用本地默认', e)
    state.asr.providers = LOCAL_ASR.map((p) => ({
      ...p,
      enabled: p.id !== 'asr.cloud',
    }))
    state.llm.providers = LOCAL_LLM.map((p) => ({
      ...p,
      enabled: p.id !== 'llm.cloud',
    }))
  } finally {
    state.loaded = true
  }
  return readonly(state)
}

export function getProviderState() {
  return readonly(state)
}

/** 切换 ASR：只改 activeId，voice 下次 start 时读取 */
export function activateAsr(id) {
  const p = state.asr.providers.find((x) => x.id === id)
  if (!p || !p.enabled) return false
  state.asr.activeId = id
  return true
}

export function activateLlm(id) {
  const p = state.llm.providers.find((x) => x.id === id)
  if (!p || !p.enabled) return false
  state.llm.activeId = id
  return true
}

/** 绑定实验流 A/B/C：同步到服务端便于埋点 */
export async function setBindVariant(variant) {
  if (!['A', 'B', 'C'].includes(variant)) return false
  state.bind.activeVariant = variant
  try {
    await fetch('/api/bind/variant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variant }),
    })
  } catch {
    /* Demo：本地已切换即可 */
  }
  return true
}

/** 把 asr.* id 映射成 VoiceInput 的 channel 字符串 */
export function asrIdToChannel(id) {
  if (id === 'asr.cloud') return 'cloud'
  if (id === 'asr.mock') return 'mock'
  return 'browser'
}

export function isLlmCloud() {
  return state.llm.activeId === 'llm.cloud'
}
