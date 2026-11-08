<script setup>
/**
 * 设置面板：通道切换、绑定流 A/B/C、画幅缩放、实验导出
 */
import { computed } from 'vue'
import {
  activateAsr,
  activateLlm,
  getProviderState,
  setBindVariant,
} from '../modules/api-switch/index.js'

const props = defineProps({
  open: Boolean,
  scaleMode: String,
  customScale: Number,
  scaleValue: Number,
})
const emit = defineEmits(['close', 'set-scale-mode', 'set-custom-scale'])

const providers = computed(() => getProviderState())

const scalePercent = computed(() => Math.round((props.scaleValue || 1) * 100) + '%')

function onAsr(id) {
  activateAsr(id)
}
function onLlm(id) {
  activateLlm(id)
}
async function onVariant(v) {
  await setBindVariant(v)
}

async function exportExperiment() {
  // 打开服务端导出接口（JSONL，无身份证明文）
  window.open('/api/experiment/export', '_blank')
}
</script>

<template>
  <div v-if="open" class="mask" @click.self="emit('close')">
    <aside class="panel-settings" role="dialog" aria-label="设置">
      <header class="head">
        <h2>设置</h2>
        <button class="btn-ghost" type="button" @click="emit('close')">关闭</button>
      </header>

      <section>
        <h3>画幅大小（可控）</h3>
        <p class="desc">设计分辨率固定 1920×1080，下面只改整体缩放，不改变构图。</p>
        <p class="desc">当前缩放：{{ scalePercent }}</p>
        <div class="row">
          <button
            class="btn-ghost"
            :class="{ 'is-active': scaleMode === 'fit' }"
            type="button"
            @click="emit('set-scale-mode', 'fit')"
          >
            自适应窗口
          </button>
          <button
            class="btn-ghost"
            :class="{ 'is-active': scaleMode === 'exact' }"
            type="button"
            @click="emit('set-scale-mode', 'exact')"
          >
            100% 原尺寸
          </button>
        </div>
        <div class="row">
          <button class="btn-ghost" type="button" @click="emit('set-custom-scale', 0.5)">50%</button>
          <button class="btn-ghost" type="button" @click="emit('set-custom-scale', 0.75)">75%</button>
          <button class="btn-ghost" type="button" @click="emit('set-custom-scale', 1.25)">125%</button>
        </div>
      </section>

      <section>
        <h3>语音识别通道</h3>
        <div class="row wrap">
          <button
            v-for="p in providers.asr.providers"
            :key="p.id"
            class="btn-ghost"
            :class="{ 'is-active': providers.asr.activeId === p.id }"
            :disabled="!p.enabled"
            type="button"
            @click="onAsr(p.id)"
          >
            {{ p.label }}{{ p.enabled ? '' : '（不可用）' }}
          </button>
        </div>
      </section>

      <section>
        <h3>对话通道</h3>
        <div class="row wrap">
          <button
            v-for="p in providers.llm.providers"
            :key="p.id"
            class="btn-ghost"
            :class="{ 'is-active': providers.llm.activeId === p.id }"
            :disabled="!p.enabled"
            type="button"
            @click="onLlm(p.id)"
          >
            {{ p.label }}{{ p.enabled ? '' : '（不可用）' }}
          </button>
        </div>
      </section>

      <section>
        <h3>首次绑定实验流</h3>
        <div class="row">
          <button
            v-for="v in providers.bind.variants"
            :key="v"
            class="btn-ghost"
            :class="{ 'is-active': providers.bind.activeVariant === v }"
            type="button"
            @click="onVariant(v)"
          >
            流 {{ v }}
          </button>
        </div>
        <p class="desc">A 先绑再诊 · B 先导诊再绑 · C 强调家人代操作</p>
      </section>

      <section>
        <h3>实验数据</h3>
        <button class="btn-primary" type="button" @click="exportExperiment">导出绑定实验 JSONL</button>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.mask {
  position: absolute;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  justify-content: flex-end;
}
.panel-settings {
  width: 720px;
  height: 100%;
  background: #0c1a17;
  border-left: 1px solid var(--line);
  padding: 40px 48px;
  overflow: auto;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}
.head h2 {
  margin: 0;
  font-size: 40px;
}
section {
  margin-bottom: 36px;
}
h3 {
  margin: 0 0 12px;
  font-size: 28px;
}
.desc {
  margin: 0 0 14px;
  font-size: 22px;
  color: var(--muted);
  line-height: 1.4;
}
.row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.btn-ghost:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
