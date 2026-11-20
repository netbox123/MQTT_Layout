<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">Edit Tow List Card</h2>

        <div class="mobile-row">
          <label class="field-label">Mobile</label>
          <label class="field-checkbox">
            <input type="checkbox" v-model="localMobileShow" />
            <span>{{ localMobileShow ? 'Yes' : 'No' }}</span>
          </label>
          <label class="field-label">Order</label>
          <input class="field-input field-input--short" type="number" min="0" v-model.number="localMobileOrder" />
        </div>

        <div class="field-label">Years</div>
        <div class="item-list">
          <div v-for="(year, i) in localYears" :key="i" class="item-row">
            <span class="item-name">{{ year }}</span>
            <button class="remove-btn" type="button" @click="removeYear(i)">Remove</button>
          </div>
          <div v-if="!localYears.length" class="no-selection">No extra years added</div>
        </div>
        <div class="add-row">
          <input class="field-input" v-model="newYear" placeholder="e.g. 2028" @keyup.enter="addYear" />
          <button class="done-btn" type="button" @click="addYear">+ Add</button>
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
import { ref } from 'vue';

const props = defineProps({
  card: { type: Object, required: true },
  isNew: { type: Boolean, default: false },
});

const emit = defineEmits(['save', 'cancel', 'delete']);

const localYears = ref([...(props.card.years ?? [])]);
const newYear = ref('');
const localMobileShow = ref(props.card.mobile_show !== false);
const localMobileOrder = ref(props.card.mobile_order ?? 0);

function addYear() {
  const y = newYear.value.trim();
  if (/^\d{4}$/.test(y) && !localYears.value.includes(y)) {
    localYears.value = [...localYears.value, y].sort();
  }
  newYear.value = '';
}

function removeYear(i) {
  localYears.value = localYears.value.filter((_, idx) => idx !== i);
}

function save() {
  emit('save', { ...props.card, years: localYears.value, mobile_show: localMobileShow.value, mobile_order: localMobileOrder.value });
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
  gap: 0.75rem;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
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

.field-input:focus { border-color: var(--accent-blue); }

.item-list {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  max-height: 180px;
  overflow-y: auto;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  height: 36px;
  padding: 0 0.75rem;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.item-row:last-child { border-bottom: none; }

.item-name { flex: 1; }

.remove-btn {
  background: none;
  border: 1px solid var(--accent-red);
  border-radius: 5px;
  color: var(--accent-red);
  font-size: 0.75rem;
  font-family: inherit;
  padding: 0.15rem 0.5rem;
  cursor: pointer;
}

.remove-btn:hover { background: var(--accent-red); color: #fff; }

.no-selection {
  font-size: 0.85rem;
  color: #9aa3bc;
  text-align: center;
  padding: 0.6rem 0;
}

.add-row {
  display: flex;
  gap: 0.5rem;
}

.done-btn {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: #9aa3bc;
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  white-space: nowrap;
}

.done-btn:hover { background: #313858; }

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
