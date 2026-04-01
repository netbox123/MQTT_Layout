<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">{{ title || (isNew ? 'New Card' : 'Edit Card') }}</h2>
        <div class="fields">
          <!-- Mobile + Order always on top -->
          <div class="mobile-row">
            <label class="field-label">Mobile</label>
            <label class="field-checkbox">
              <input type="checkbox" :checked="flatFields.mobile_show" @change="onInput('mobile_show', $event.target.checked)" />
              <span>{{ flatFields.mobile_show ? 'Yes' : 'No' }}</span>
            </label>
            <label class="field-label">Order</label>
            <input class="field-input field-input--short" type="number" min="0" :value="flatFields.mobile_order" @input="onInput('mobile_order', $event.target.value)" />
          </div>
          <template v-for="(_, key) in flatFields" :key="key">
            <template v-if="!key.startsWith('position_') && key !== 'type' && key !== 'mobile_show' && key !== 'mobile_order' && !hiddenFields.includes(key)">
              <label class="field-label">{{ key.replace(/_/g, ' ') }}</label>
              <template v-if="key === 'icon'">
                <button class="icon-field" type="button" @click="showIconPicker = true">
                  <svg v-if="flatFields.icon && ICON_MAP[flatFields.icon]" viewBox="0 0 24 24" width="18" height="18">
                    <path :d="ICON_MAP[flatFields.icon]" fill="currentColor" />
                  </svg>
                  <span class="icon-field-name">{{ flatFields.icon || 'Choose icon…' }}</span>
                </button>
              </template>
              <input
                v-else
                class="field-input"
                :type="inputType(flatFields[key])"
                :value="flatFields[key]"
                @input="onInput(key, $event.target.value)"
              />
            </template>
          </template>
        </div>
        <PageIconPicker
          v-if="showIconPicker"
          :modelValue="flatFields.icon"
          @update:modelValue="val => { flatFields.icon = val; showIconPicker = false; }"
          @cancel="showIconPicker = false"
        />
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
import { reactive, ref } from 'vue';
import PageIconPicker from './PageIconPicker.vue';
import { ICON_MAP } from '../../utils/pageIcons.js';

const props = defineProps({
  card: { type: Object, required: true },
  isNew: { type: Boolean, default: false },
  title: { type: String, default: '' },
  hiddenFields: { type: Array, default: () => [] },
});

const emit = defineEmits(['save', 'cancel', 'delete']);

// Flatten position into top-level keys (position.x → position_x)
function flatten(card) {
  const result = {};
  for (const [k, v] of Object.entries(card)) {
    if (k === 'position' && typeof v === 'object') {
      for (const [pk, pv] of Object.entries(v)) {
        result[`position_${pk}`] = pv;
      }
    } else {
      result[k] = v;
    }
  }
  if (result.type === 'switch' && !('icon' in result)) result.icon = '';
  if (!('mobile_show' in result)) result.mobile_show = true;
  if (!('mobile_order' in result)) result.mobile_order = 0;
  return result;
}

function unflatten(flat) {
  const result = {};
  const pos = {};
  for (const [k, v] of Object.entries(flat)) {
    if (k.startsWith('position_')) {
      pos[k.replace('position_', '')] = Number(v);
    } else if (k === 'mobile_show') {
      result[k] = v === true || v === 'true';
    } else if (k === 'mobile_order') {
      result[k] = Number(v);
    } else {
      result[k] = typeof props.card[k] === 'number' ? Number(v) : v;
    }
  }
  if (Object.keys(pos).length) result.position = pos;
  return result;
}

const flatFields = reactive(flatten(props.card));
const showIconPicker = ref(false);

function inputType(value) {
  return typeof value === 'number' ? 'number' : 'text';
}

function onInput(key, value) {
  flatFields[key] = value;
}

function save() {
  emit('save', unflatten(flatFields));
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.75rem;
  width: 420px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.fields {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
  align-items: center;
  overflow-y: auto;
}

.mobile-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  grid-column: 1 / -1;
}

.field-input--short {
  width: 8ch !important;
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
}

.field-input:focus {
  border-color: var(--accent-blue);
}

.icon-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.875rem;
  padding: 0.35rem 0.6rem;
  font-family: inherit;
  cursor: pointer;
  width: 100%;
  text-align: left;
}

.icon-field:hover {
  border-color: var(--accent-blue);
}

.icon-field-name {
  color: var(--text-secondary);
}

.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.25rem;
}

.modal-actions-right {
  display: flex;
  gap: 0.5rem;
}

.modal-delete {
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  background: transparent;
  color: var(--accent-red);
  border: 1px solid var(--accent-red);
}

.modal-delete:hover {
  background: var(--accent-red);
  color: #fff;
}

.modal-cancel, .modal-confirm {
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
}

.modal-cancel {
  background: #2a3150;
  color: #9aa3bc;
  border: 1px solid #3d4870;
}

.modal-cancel:hover { background: #313858; }

.modal-confirm {
  background: var(--accent-blue);
  color: #fff;
}
</style>
