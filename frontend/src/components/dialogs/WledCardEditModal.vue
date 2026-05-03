<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">{{ isNew ? 'New WLED Card' : 'Edit WLED Card' }}</h2>

        <div class="mobile-row">
          <label class="field-label">Mobile</label>
          <label class="field-checkbox">
            <input type="checkbox" v-model="localMobileShow" />
            <span>{{ localMobileShow ? 'Yes' : 'No' }}</span>
          </label>
          <label class="field-label">Order</label>
          <input class="field-input field-input--short" type="number" min="0" v-model.number="localMobileOrder" />
        </div>

        <div class="device-list">
          <div v-if="!localDevices.length" class="no-devices">
            No WLED devices configured — add them on the WLED page first.
          </div>
          <div v-for="d in localDevices" :key="d.id" class="device-item">
            <label class="device-check">
              <input type="checkbox" v-model="d.enabled" />
              <span class="device-name">{{ d.name }}</span>
            </label>
            <select v-if="d.enabled" class="preset-select" v-model="d.presetKey">
              <option value="">— pick color —</option>
              <optgroup v-for="cat in presetsByCategory" :key="cat.name" :label="cat.name">
                <option v-for="p in cat.presets" :key="p.key" :value="p.key">
                  {{ p.name }}
                </option>
              </optgroup>
            </select>
            <span v-if="d.enabled && d.presetKey" class="preset-swatch" :style="{ background: swatchColor(d.presetKey) }"></span>
          </div>
        </div>

        <div class="modal-actions">
          <button v-if="!isNew" class="modal-delete" @click="$emit('delete')">Delete</button>
          <span v-else></span>
          <div class="modal-actions-right">
            <button class="modal-cancel" @click="$emit('cancel')">Cancel</button>
            <button class="modal-confirm" @click="save">OK</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  card: { type: Object, required: true },
  isNew: { type: Boolean, default: false },
});
const emit = defineEmits(['save', 'cancel', 'delete']);

const localMobileShow  = ref(props.card.mobile_show !== false);
const localMobileOrder = ref(props.card.mobile_order ?? 0);

const localDevices = ref([]);
const allPresets   = ref([]);

async function init() {
  const [devRes, colorRes] = await Promise.all([
    fetch('/api/wled-devices'),
    fetch('/api/colors'),
  ]);
  const wledDevices = devRes.ok ? await devRes.json() : [];
  const colors      = colorRes.ok ? await colorRes.json() : { presets: [] };
  allPresets.value  = colors.presets ?? [];

  localDevices.value = wledDevices.map(d => {
    const existing   = (props.card.devices ?? []).find(cd => cd.id === d.id);
    const presetKey  = existing?.preset
      ? `${existing.preset.category}/${existing.preset.name}`
      : '';
    return { id: d.id, name: d.name, enabled: !!existing, presetKey };
  });
}
init();

const presetsByCategory = computed(() => {
  const map = {};
  for (const p of allPresets.value) {
    if (!map[p.category]) map[p.category] = { name: p.category, presets: [] };
    map[p.category].presets.push({ key: `${p.category}/${p.name}`, name: p.name, ...p });
  }
  return Object.values(map);
});

function resolvePreset(key) {
  if (!key) return null;
  const [cat, ...rest] = key.split('/');
  const name = rest.join('/');
  return allPresets.value.find(p => p.category === cat && p.name === name) ?? null;
}

function swatchColor(key) {
  const p = resolvePreset(key);
  if (!p) return '#333';
  const r = Math.min(255, (p.r ?? 0) + (p.w ?? 0));
  const g = Math.min(255, (p.g ?? 0) + (p.w ?? 0));
  const b = Math.min(255, (p.b ?? 0) + (p.w ?? 0));
  return `rgb(${r}, ${g}, ${b})`;
}

function save() {
  const devices = localDevices.value
    .filter(d => d.enabled)
    .map(d => ({ id: d.id, preset: resolvePreset(d.presetKey) ?? null }));
  emit('save', {
    ...props.card,
    devices,
    mobile_show:  localMobileShow.value,
    mobile_order: localMobileOrder.value,
  });
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 1000;
  overflow-y: auto;
  padding: 2rem 0;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.75rem;
  width: 380px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.mobile-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
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
}
.field-input--short { width: 8ch; }
.field-input:focus { border-color: var(--accent-blue); }

.device-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.no-devices {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.device-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.device-check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  min-width: 130px;
}

.device-name {
  font-size: 0.875rem;
  color: var(--text-primary);
}

.preset-select {
  flex: 1;
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.8rem;
  padding: 0.3rem 0.5rem;
  font-family: inherit;
  outline: none;
}
.preset-select:focus { border-color: var(--accent-blue); }

.preset-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.1);
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.25rem;
}
.modal-actions-right { display: flex; gap: 0.5rem; }

.modal-delete {
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  background: transparent;
  color: var(--accent-red);
  border: 1px solid var(--accent-red);
  cursor: pointer;
}
.modal-delete:hover { background: var(--accent-red); color: #fff; }

.modal-cancel, .modal-confirm {
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  cursor: pointer;
}
.modal-cancel { background: #2a3150; color: #9aa3bc; border: 1px solid #3d4870; }
.modal-cancel:hover { background: #313858; }
.modal-confirm { background: var(--accent-blue); color: #fff; }
</style>
