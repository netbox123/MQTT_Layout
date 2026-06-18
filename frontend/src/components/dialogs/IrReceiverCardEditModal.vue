<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">{{ isNew ? 'New IR Receivers Card' : 'Edit IR Receivers Card' }}</h2>

        <div class="mobile-row">
          <label class="field-label">Mobile</label>
          <label class="field-checkbox">
            <input type="checkbox" v-model="localMobileShow" />
            <span>{{ localMobileShow ? 'Yes' : 'No' }}</span>
          </label>
          <label class="field-label">Order</label>
          <input class="field-input field-input--short" type="number" min="0" v-model.number="localMobileOrder" />
        </div>

        <div class="name-row">
          <label class="field-label">Name</label>
          <input class="field-input" v-model="localTitle" placeholder="IR Devices" />
        </div>

        <div class="receivers-section">
          <label class="field-label">Visible receivers</label>
          <div class="receiver-check-list">
            <div v-if="!allReceivers.length" class="no-receivers">No receivers configured</div>
            <label v-for="r in allReceivers" :key="r.id" class="receiver-check-item">
              <input type="checkbox" :value="r.id" v-model="localReceiverIds" />
              <span class="receiver-check-name">{{ r.name }}</span>
              <span class="receiver-type-badge">{{ TYPE_LABELS[r.type] ?? r.type }}</span>
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
import { ref, onMounted } from 'vue';

const props = defineProps({
  card:  { type: Object,  required: true },
  isNew: { type: Boolean, default: false },
});
const emit = defineEmits(['save', 'cancel', 'delete']);

const TYPE_LABELS = { philips_tv: 'Philips TV', lg_tv: 'LG TV', soundbar: 'Soundbar' };

const localTitle        = ref(props.card.title ?? '');
const localMobileShow   = ref(props.card.mobile_show !== false);
const localMobileOrder  = ref(props.card.mobile_order ?? 0);
const localReceiverIds  = ref([]);
const allReceivers      = ref([]);

onMounted(async () => {
  try {
    const configKey = props.card.config_key || props.card.title || 'default';
    const res = await fetch(`/api/ir-receivers/${encodeURIComponent(configKey)}`);
    if (res.ok) {
      allReceivers.value = await res.json();
      const hidden = new Set(props.card.hidden_receiver_ids ?? []);
      localReceiverIds.value = allReceivers.value.map(r => r.id).filter(id => !hidden.has(id));
    }
  } catch { /* ignore */ }
});

function save() {
  const allIds = allReceivers.value.map(r => r.id);
  const checked = new Set(localReceiverIds.value);
  const { receiver_ids, ...rest } = props.card;
  emit('save', {
    ...rest,
    title:               localTitle.value,
    mobile_show:         localMobileShow.value,
    mobile_order:        localMobileOrder.value,
    hidden_receiver_ids: allIds.filter(id => !checked.has(id)),
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
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-title { font-size: 1rem; font-weight: 600; color: var(--text-primary); }

.mobile-row, .name-row {
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

.field-label { font-size: 0.8rem; color: #9aa3bc; white-space: nowrap; }

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

.receivers-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.receiver-check-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #3d4870;
  border-radius: 6px;
  padding: 0.5rem 0.6rem;
  background: #2a3150;
}

.no-receivers { font-size: 0.85rem; color: var(--text-muted); }

.receiver-check-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.receiver-check-name { font-size: 0.875rem; color: var(--text-primary); flex: 1; }

.receiver-type-badge {
  font-size: 0.65rem;
  color: var(--text-muted);
  background: #1e2840;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.1rem 0.4rem;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.25rem;
}
.modal-actions-right { display: flex; gap: 0.5rem; }

.modal-delete {
  border-radius: 6px; font-size: 0.875rem; font-family: inherit;
  padding: 0.5rem 1.25rem; background: transparent;
  color: var(--accent-red); border: 1px solid var(--accent-red); cursor: pointer;
}
.modal-delete:hover { background: var(--accent-red); color: #fff; }

.modal-cancel, .modal-confirm {
  border: none; border-radius: 6px;
  font-size: 0.875rem; font-family: inherit; padding: 0.5rem 1.25rem; cursor: pointer;
}
.modal-cancel { background: #2a3150; color: #9aa3bc; border: 1px solid #3d4870; }
.modal-cancel:hover { background: #313858; }
.modal-confirm { background: var(--accent-blue); color: #fff; }
</style>
