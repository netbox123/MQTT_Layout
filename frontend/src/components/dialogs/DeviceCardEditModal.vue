<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">{{ isNew ? `New ${label} Card` : `Edit ${label}` }}</h2>

        <div class="fields">
          <div class="mobile-row">
            <label class="field-label">Mobile</label>
            <label class="field-checkbox">
              <input type="checkbox" v-model="form.mobile_show" />
              <span>{{ form.mobile_show ? 'Yes' : 'No' }}</span>
            </label>
            <label class="field-label">Order</label>
            <input class="field-input field-input--short" type="number" min="0" v-model.number="form.mobile_order" />
          </div>

          <label class="field-label">Title</label>
          <input class="field-input" type="text" v-model="form.title" />

          <label class="field-label">MQTT prefix</label>
          <input class="field-input" type="text" v-model="form.mqtt_prefix" />
        </div>

        <div class="device-section">
          <div class="device-section-title">
            Devices to show
            <span class="device-hint">(none selected = show all)</span>
          </div>
          <div v-if="!devices.length" class="device-empty">No devices found on "{{ form.mqtt_prefix }}"</div>
          <div v-else class="device-list">
            <label v-for="d in devices" :key="d.id" class="device-row">
              <input type="checkbox" :value="d.id" v-model="form.included_ids" />
              <span class="dot" :class="d.online ? 'dot--on' : 'dot--off'"></span>
              <span class="device-name">{{ d.name }}</span>
              <span class="device-meta">{{ d.ip }}</span>
            </label>
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
import { reactive, computed } from 'vue';
import { useMqttStore } from '../../stores/mqttStore.js';

const props = defineProps({
  card:  { type: Object,  required: true },
  isNew: { type: Boolean, default: false },
});

const emit = defineEmits(['save', 'cancel', 'delete']);

const mqttStore = useMqttStore();

const label = computed(() => props.card.type === 'tv' ? 'TVs' : 'Machines');

const form = reactive({
  title:        props.card.title        ?? '',
  mqtt_prefix:  props.card.mqtt_prefix  ?? '',
  included_ids: [...(props.card.included_ids ?? [])],
  mobile_show:  props.card.mobile_show  ?? true,
  mobile_order: props.card.mobile_order ?? 0,
});

const devices = computed(() => {
  const result = [];
  const pfx = form.mqtt_prefix;
  if (!pfx) return result;
  for (const [topic, value] of Object.entries(mqttStore.topicValues)) {
    if (!topic.startsWith(pfx + '/') || !topic.endsWith('/state')) continue;
    const id = topic.slice(pfx.length + 1, -'/state'.length);
    if (!id || id.includes('/')) continue;
    let state = null;
    try { state = JSON.parse(value); } catch { /* skip */ }
    const onlineRaw = mqttStore.topicValues[`${pfx}/${id}/online`];
    result.push({
      id,
      name:   state?.name  ?? id,
      ip:     state?.ip    ?? '',
      online: onlineRaw === 'ON' || onlineRaw === true,
    });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
});

function save() {
  emit('save', {
    ...props.card,
    title:        form.title,
    mqtt_prefix:  form.mqtt_prefix,
    included_ids: form.included_ids,
    mobile_show:  form.mobile_show,
    mobile_order: form.mobile_order,
  });
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
}

.mobile-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  grid-column: 1 / -1;
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

.field-input:focus { border-color: var(--accent-blue); }
.field-input--short { width: 8ch !important; }

.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
}

.device-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow: hidden;
}

.device-section-title {
  font-size: 0.8rem;
  font-weight: 500;
  color: #9aa3bc;
}

.device-hint {
  font-size: 0.72rem;
  color: #6b7499;
  font-weight: 400;
}

.device-empty {
  font-size: 0.8rem;
  color: #6b7499;
  font-style: italic;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
  max-height: 260px;
}

.device-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.85rem;
}

.device-row:hover { background: var(--bg-card-hover); }

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot--on  { background: #4caf6e; }
.dot--off { background: #e05454; }

.device-name {
  flex: 1;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-meta {
  font-size: 0.75rem;
  color: #6b7499;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-actions-right { display: flex; gap: 0.5rem; }

.modal-delete {
  border: 1px solid var(--accent-red);
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  background: transparent;
  color: var(--accent-red);
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
