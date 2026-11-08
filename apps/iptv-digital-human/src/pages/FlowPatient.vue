<script setup>
/**
 * S3 选择就诊人
 */
import { onMounted, ref } from 'vue'
import registration from '../modules/registration/index.js'

const emit = defineEmits(['select', 'back', 'toast'])
const list = ref([])
const focus = ref(0)
const loading = ref(true)

onMounted(async () => {
  try {
    list.value = await registration.listPatients()
  } catch (e) {
    emit('toast', e.message || '加载就诊人失败')
  } finally {
    loading.value = false
  }
})

function choose(i) {
  focus.value = i
  emit('select', list.value[i])
}

defineExpose({
  move(delta) {
    if (!list.value.length) return
    focus.value = (focus.value + delta + list.value.length) % list.value.length
  },
  confirm() {
    if (list.value[focus.value]) emit('select', list.value[focus.value])
  },
})
</script>

<template>
  <div class="panel">
    <h2 class="section-title">请选择就诊人</h2>
    <p class="body-text muted">证件号已脱敏显示。可用方向键选择，回车确认。</p>
    <p v-if="loading" class="body-text">加载中…</p>
    <ul class="list">
      <li
        v-for="(p, i) in list"
        :key="p.id"
        class="item focusable"
        :class="{ active: i === focus }"
        tabindex="0"
        @click="choose(i)"
        @keydown.enter.prevent="choose(i)"
      >
        <div class="name">{{ p.name }}</div>
        <div class="meta">{{ p.relation }} · {{ p.idCardMasked }} · {{ p.phoneMasked }}</div>
      </li>
    </ul>
    <button class="btn-ghost" type="button" @click="emit('back')">返回</button>
  </div>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 28px 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.item {
  padding: 20px 24px;
  border-radius: 16px;
  border: 2px solid var(--line);
  background: var(--panel);
  text-align: left;
}
.item.active,
.item:hover {
  border-color: var(--teal);
  box-shadow: inset 0 0 0 2px rgba(18, 179, 155, 0.25);
}
.name {
  font-size: 34px;
  font-weight: 600;
}
.meta {
  margin-top: 8px;
  font-size: 22px;
  color: var(--muted);
}
</style>
