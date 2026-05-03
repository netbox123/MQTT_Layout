<template>
  <div class="card color-card">
    <div class="color-header">
      <nav class="color-tabs">
        <button
          v-for="cat in categories"
          :key="cat.name"
          class="color-tab"
          :class="{ 'color-tab--active': cat.name === activeCategory }"
          @click="activeCategory = cat.name"
        >{{ cat.name }}</button>
      </nav>
    </div>
    <div class="color-list">
      <div
        v-for="(preset, idx) in filteredPresets"
        :key="preset.name + idx"
        class="color-row"
      >
        <span class="color-swatch" :style="{ background: swatchColor(preset) }"></span>
        <span class="color-name">{{ preset.name }}</span>
        <button v-if="editing" class="color-edit-btn" @click.prevent="openEdit(preset)">
          <svg viewBox="0 0 24 24" width="13" height="13"><path :d="mdiPencil" fill="currentColor" /></svg>
        </button>
      </div>
      <div v-if="filteredPresets.length === 0" class="color-empty">No presets</div>
    </div>

    <Teleport to="body">
      <div v-if="dialog" class="dialog-backdrop" @click.self="dialog = null">
        <div class="dialog">
          <h3 class="dialog-title">{{ dialog.isNew ? 'Add Preset' : 'Edit Preset' }}</h3>

          <div class="color-preview" :style="{ background: swatchColor(dialog) }"></div>

          <div class="sliders">
            <div class="slider-row">
              <span class="slider-label slider-label--r">R</span>
              <input type="range" min="0" max="255" v-model.number="dialog.r" class="slider slider--r" />
              <span class="slider-value">{{ dialog.r }}</span>
            </div>
            <div class="slider-row">
              <span class="slider-label slider-label--g">G</span>
              <input type="range" min="0" max="255" v-model.number="dialog.g" class="slider slider--g" />
              <span class="slider-value">{{ dialog.g }}</span>
            </div>
            <div class="slider-row">
              <span class="slider-label slider-label--b">B</span>
              <input type="range" min="0" max="255" v-model.number="dialog.b" class="slider slider--b" />
              <span class="slider-value">{{ dialog.b }}</span>
            </div>
            <div class="slider-row">
              <span class="slider-label slider-label--w">W</span>
              <input type="range" min="0" max="255" v-model.number="dialog.w" class="slider slider--w" />
              <span class="slider-value">{{ dialog.w }}</span>
            </div>
          </div>

          <div class="fields">
            <label class="field-label">name</label>
            <input class="field-input" v-model="dialog.name" placeholder="Preset name" />
            <label class="field-label">category</label>
            <select class="field-input" v-model="dialog.category">
              <option v-for="cat in categories" :key="cat.name" :value="cat.name">{{ cat.name }}</option>
            </select>
            <label class="field-label">order</label>
            <input class="field-input" type="number" min="0" v-model.number="dialog.order" />
          </div>

          <div class="dialog-actions">
            <button v-if="!dialog.isNew" class="dialog-delete" @click="deletePreset">Delete</button>
            <span v-else></span>
            <div class="dialog-actions-right">
              <button class="dialog-cancel" @click="dialog = null">Cancel</button>
              <button class="dialog-confirm" @click="savePreset">OK</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
export const icon = '🎨';
</script>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, defineExpose } from 'vue';
import { mdiPencil } from '@mdi/js';

const props = defineProps({ card: Object });
const editing = inject('editing', ref(false));

const allCategories = ref([]);
const allPresets    = ref([]);
const activeCategory = ref('');
const dialog = ref(null);

async function fetchColors() {
  try {
    const res = await fetch('/api/colors');
    if (!res.ok) return;
    const data = await res.json();
    allCategories.value = [...(data.categories ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    allPresets.value = data.presets ?? [];
    if (!activeCategory.value || !allCategories.value.find(c => c.name === activeCategory.value)) {
      activeCategory.value = allCategories.value[0]?.name ?? '';
    }
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchColors();
  window.addEventListener('colors-updated', fetchColors);
});
onUnmounted(() => window.removeEventListener('colors-updated', fetchColors));

const categories = computed(() => allCategories.value);

const filteredPresets = computed(() =>
  allPresets.value
    .filter(p => p.category === activeCategory.value)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
);

function swatchColor(preset) {
  const r = Math.min(255, (preset.r ?? 0) + (preset.w ?? 0));
  const g = Math.min(255, (preset.g ?? 0) + (preset.w ?? 0));
  const b = Math.min(255, (preset.b ?? 0) + (preset.w ?? 0));
  return `rgb(${r}, ${g}, ${b})`;
}

function openEdit(preset) {
  dialog.value = { ...preset, isNew: false, _original: preset };
}

function openAdd() {
  dialog.value = {
    name: '', category: activeCategory.value,
    order: filteredPresets.value.length,
    r: 255, g: 255, b: 255, w: 0,
    isNew: true,
  };
}

async function savePreset() {
  const { isNew, _original, ...data } = dialog.value;
  const updated = [...allPresets.value];
  if (isNew) {
    updated.push(data);
  } else {
    const idx = updated.indexOf(_original);
    if (idx !== -1) updated[idx] = data;
  }
  await patchColors(updated);
  dialog.value = null;
}

async function deletePreset() {
  const updated = allPresets.value.filter(p => p !== dialog.value._original);
  await patchColors(updated);
  dialog.value = null;
}

async function patchColors(presets) {
  const categoryNames = [...new Set(presets.map(p => p.category))];
  const categories = categoryNames.map((name, i) => {
    const existing = allCategories.value.find(c => c.name === name);
    return existing ?? { name, order: allCategories.value.length + i };
  });
  try {
    await fetch('/api/colors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories, presets }),
    });
    window.dispatchEvent(new CustomEvent('colors-updated'));
  } catch { /* ignore */ }
}

defineExpose({ openAdd });
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.color-header {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.color-tabs {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  flex: 1;
  min-width: 0;
}
.color-tabs::-webkit-scrollbar { display: none; }

.color-tab {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.4rem 0.75rem;
  white-space: nowrap;
  font-family: inherit;
  cursor: pointer;
}
.color-tab--active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-blue, #3b82f6);
}

.color-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 4px;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.6rem;
  height: 2rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}
.color-row:last-of-type { border-bottom: none; }

.color-swatch {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.1);
}

.color-name {
  flex: 1;
  font-size: 0.78rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.color-edit-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.2rem;
  display: flex;
  align-items: center;
  border-radius: 3px;
  flex-shrink: 0;
}
.color-edit-btn:hover { color: var(--accent-blue); background: var(--bg-base); }

.color-empty {
  padding: 0.75rem 0.6rem;
  font-size: 0.78rem;
  color: var(--text-muted);
}

/* Dialog */
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.5rem;
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.color-preview {
  height: 48px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  transition: background 0.1s;
}

/* RGBW sliders */
.sliders {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.slider-label {
  width: 14px;
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
  flex-shrink: 0;
}
.slider-label--r { color: #e05454; }
.slider-label--g { color: #4caf6e; }
.slider-label--b { color: #5090d0; }
.slider-label--w { color: #aaaaaa; }

.slider {
  flex: 1;
  height: 4px;
  appearance: none;
  -webkit-appearance: none;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.slider--r { accent-color: #e05454; background: linear-gradient(to right, #1a0000, #e05454); }
.slider--g { accent-color: #4caf6e; background: linear-gradient(to right, #001a00, #4caf6e); }
.slider--b { accent-color: #5090d0; background: linear-gradient(to right, #00001a, #5090d0); }
.slider--w { accent-color: #cccccc; background: linear-gradient(to right, #222222, #cccccc); }

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.2);
  cursor: pointer;
}

.slider-value {
  width: 28px;
  text-align: right;
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* Fields */
.fields {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
  align-items: center;
}

.field-label {
  font-size: 0.8rem;
  color: #9aa3bc;
  white-space: nowrap;
}

.field-input {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.875rem;
  padding: 0.35rem 0.6rem;
  font-family: inherit;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.field-input:focus { border-color: var(--accent-blue); }

.dialog-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dialog-actions-right { display: flex; gap: 0.5rem; }

.dialog-delete {
  background: transparent;
  color: var(--accent-red);
  border: 1px solid var(--accent-red);
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  cursor: pointer;
}
.dialog-delete:hover { background: var(--accent-red); color: #fff; }

.dialog-cancel, .dialog-confirm {
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  cursor: pointer;
}
.dialog-cancel { background: #2a3150; color: #9aa3bc; border: 1px solid #3d4870; }
.dialog-cancel:hover { background: #313858; }
.dialog-confirm { background: var(--accent-blue); color: #fff; }
</style>
