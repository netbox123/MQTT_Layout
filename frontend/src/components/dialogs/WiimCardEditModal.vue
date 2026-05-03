<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">{{ isNew ? 'New WiiM Card' : 'Edit WiiM Card' }}</h2>

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
          <input class="field-input" type="text" v-model="form.title" placeholder="WiiM Pro" />

          <label class="field-label">IP Address</label>
          <input class="field-input" type="text" v-model="form.ip" placeholder="192.168.0.22" />
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
import { reactive } from 'vue';

const props = defineProps({
  card:  { type: Object,  required: true },
  isNew: { type: Boolean, default: false },
});
const emit = defineEmits(['save', 'cancel', 'delete']);

const form = reactive({
  title:        props.card.title        ?? '',
  ip:           props.card.ip           ?? '',
  mobile_show:  props.card.mobile_show  ?? true,
  mobile_order: props.card.mobile_order ?? 0,
});

function save() {
  emit('save', {
    ...props.card,
    title:        form.title,
    ip:           form.ip,
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
  width: 360px;
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
