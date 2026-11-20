<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">{{ isNew ? 'New KVM Switch Card' : 'Edit KVM Switch Card' }}</h2>

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
          <input class="field-input" type="text" v-model="form.title" placeholder="KVM Switch" />

          <div class="section-header">Button names</div>
          <div class="labels-grid">
            <template v-for="(inp, i) in form.inputs" :key="i">
              <span class="input-default-name">Input {{ i + 1 }}</span>
              <input class="field-input" type="text" v-model="inp.label" :placeholder="`Input ${i + 1}`" />
            </template>
          </div>

          <div class="section-header">
            Advanced
            <label class="field-checkbox">
              <input type="checkbox" v-model="showAdvanced" />
              <span>{{ showAdvanced ? 'Show' : 'Hide' }}</span>
            </label>
          </div>
          <div v-if="showAdvanced" class="labels-grid">
            <template v-for="(inp, i) in form.inputs" :key="'t' + i">
              <span class="input-default-name">Relay {{ i + 1 }}</span>
              <input class="field-input" type="text" v-model="inp.command_topic" :placeholder="DEFAULT_INPUTS[i].command_topic" />
            </template>
            <span class="input-default-name">Pulse (ms)</span>
            <input class="field-input field-input--short" type="number" min="50" step="50" v-model.number="form.pulse_ms" />
            <span class="input-default-name">State topic</span>
            <input class="field-input" type="text" v-model="form.mqtt_topic" placeholder="kvm/shed8b/active" />
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
import { reactive, ref } from 'vue';
import { DEFAULT_INPUTS } from '../cards/KvmSwitchCard.vue';

const props = defineProps({
  card:  { type: Object,  required: true },
  isNew: { type: Boolean, default: false },
});
const emit = defineEmits(['save', 'cancel', 'delete']);

const showAdvanced = ref(false);

const form = reactive({
  title:        props.card.title        ?? 'KVM Switch',
  mobile_show:  props.card.mobile_show  ?? true,
  mobile_order: props.card.mobile_order ?? 0,
  pulse_ms:     props.card.pulse_ms     ?? 300,
  mqtt_topic:   props.card.mqtt_topic   ?? 'kvm/shed8b/active',
  inputs: DEFAULT_INPUTS.map((def, i) => ({
    label:         props.card.inputs?.[i]?.label         ?? def.label,
    command_topic: props.card.inputs?.[i]?.command_topic ?? def.command_topic,
  })),
});

function save() {
  emit('save', {
    ...props.card,
    title:        form.title,
    mobile_show:  form.mobile_show,
    mobile_order: form.mobile_order,
    pulse_ms:     form.pulse_ms || 300,
    mqtt_topic:   form.mqtt_topic.trim(),
    inputs: form.inputs.map((inp, i) => ({
      label:         inp.label.trim() || `Input ${i + 1}`,
      command_topic: inp.command_topic.trim() || DEFAULT_INPUTS[i].command_topic,
    })),
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
  width: 380px;
  max-width: calc(100vw - 32px);
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

.section-header {
  grid-column: 1 / -1;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7694;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.labels-grid {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.4rem 0.75rem;
  align-items: center;
}
.input-default-name {
  font-size: 0.8rem;
  color: #9aa3bc;
  white-space: nowrap;
}

.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
  text-transform: none;
  letter-spacing: normal;
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
