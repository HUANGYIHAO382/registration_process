<script setup>
/**
 * S5 时段选择：最多 3 个
 */
import { ref, watch } from 'vue'

const props = defineProps({
  slots: { type: Array, default: () => [] },
  department: String,
})
const emit = defineEmits(['select', 'back'])
const focus = ref(0)

watch(
  () => props.slots,
  () => {
    focus.value = 0
  }
)

defineExpose({
  move(delta) {
    const n = props.slots.length
    if (!n) return
    focus.value = (focus.value + delta + n) % n
  },
  confirm() {
    if (props.slots[focus.value]) emit('select', props.slots[focus.value])
  },
})
</script>

<template>
  <div class="panel">
    <h2 class="section-title">请选择就诊时间</h2>
    <p class="body-text muted">科室：{{ department || '—' }}（最多显示 3 个时段）</p>
    <ul class="list">
      <li
        v-for="(s, i) in slots"
        :key="s.slotId"
        class="item"
        :class="{ active: i === focus }"
        @click="emit('select', s)"
      >
        <div class="label">{{ s.label }}</div>
        <div class="meta">{{ s.doctorName }} · {{ s.clinicType }} · 余号 {{ s.remain }}</div>
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
  padding: 22px 24px;
  border-radius: 16px;
  border: 2px solid var(--line);
  background: var(--panel);
  cursor: pointer;
}
.item.active,
.item:hover {
  border-color: var(--teal);
}
.label {
  font-size: 36px;
  font-weight: 600;
}
.meta {
  margin-top: 8px;
  font-size: 22px;
  color: var(--muted);
}
</style>
