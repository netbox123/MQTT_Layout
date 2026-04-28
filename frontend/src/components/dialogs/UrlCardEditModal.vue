<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">Edit Url Card</h2>

        <div class="mobile-row">
          <label class="field-label">Mobile</label>
          <label class="field-checkbox">
            <input type="checkbox" v-model="localMobileShow" />
            <span>{{ localMobileShow ? 'Yes' : 'No' }}</span>
          </label>
          <label class="field-label">Order</label>
          <input class="field-input field-input--short" type="number" min="0" v-model.number="localMobileOrder" />
        </div>

        <div class="item-list">
          <button
            v-for="(cat, i) in localCategories"
            :key="i"
            class="item-row"
            :class="{ 'item-row--active': selectedIdx === i }"
            type="button"
            @click="select(i)"
          >
            <span class="item-name">{{ cat.name }}</span>
            <span class="item-count">{{ urlCountFor(cat.name) }}</span>
          </button>
          <button class="item-row item-row--add" type="button" @click="addCategory">+ Add category</button>
        </div>

        <template v-if="selectedIdx !== null">
          <div class="fields">
            <label class="field-label">name</label>
            <input class="field-input" v-model="editName" />
            <label class="field-label">order</label>
            <input class="field-input" type="number" min="0" v-model.number="editOrder" />
          </div>
          <div class="item-btns">
            <button class="remove-btn" type="button" @click="removeCategory">Remove</button>
            <button class="done-btn" type="button" @click="applyEdit">Apply</button>
          </div>
        </template>

        <div v-else class="no-selection">Click a category to edit</div>

        <div v-if="saveError" class="save-error">{{ saveError }}</div>

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

const localCategories = ref([]);
const localUrls = ref([]);
const selectedIdx = ref(null);
const editName = ref('');
const editOrder = ref(0);
const saveError = ref('');
const localMobileShow = ref(props.card.mobile_show !== false);
const localMobileOrder = ref(props.card.mobile_order ?? 0);

fetch('/api/urls')
  .then(r => r.json())
  .then(data => {
    localCategories.value = [...(data.categories ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    localUrls.value = data.urls ?? [];
  })
  .catch(() => {});

function urlCountFor(name) {
  return localUrls.value.filter(u => u.category === name).length;
}

function select(i) {
  selectedIdx.value = i;
  editName.value = localCategories.value[i].name;
  editOrder.value = localCategories.value[i].order ?? 0;
}

function addCategory() {
  const cat = { name: 'New Category', order: localCategories.value.length };
  localCategories.value.push(cat);
  selectedIdx.value = localCategories.value.length - 1;
  editName.value = cat.name;
  editOrder.value = cat.order;
}

function applyEdit() {
  if (selectedIdx.value === null) return;
  const oldName = localCategories.value[selectedIdx.value].name;
  const newName = editName.value.trim();
  if (newName && oldName !== newName) {
    for (const u of localUrls.value) {
      if (u.category === oldName) u.category = newName;
    }
  }
  localCategories.value[selectedIdx.value] = { name: newName || oldName, order: editOrder.value };
  localCategories.value = [...localCategories.value].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  selectedIdx.value = localCategories.value.findIndex(c => c.name === (newName || oldName));
}

function removeCategory() {
  if (selectedIdx.value === null) return;
  const name = localCategories.value[selectedIdx.value].name;
  localUrls.value = localUrls.value.filter(u => u.category !== name);
  localCategories.value.splice(selectedIdx.value, 1);
  selectedIdx.value = null;
}

async function save() {
  applyEdit();
  saveError.value = '';
  try {
    const res = await fetch('/api/urls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: localCategories.value, urls: localUrls.value }),
    });
    if (!res.ok) throw new Error(await res.text());
  } catch (err) {
    saveError.value = 'Failed to save: ' + err.message;
    return;
  }
  window.dispatchEvent(new CustomEvent('urls-updated'));
  emit('save', { ...props.card, mobile_show: localMobileShow.value, mobile_order: localMobileOrder.value });
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
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
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.item-list {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  max-height: 220px;
  overflow-y: auto;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  height: 36px;
  padding: 0 0.75rem;
  background: var(--bg-card);
  border: 0;
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.item-row:last-child { border-bottom: none; }
.item-row:hover { background: var(--bg-card-hover); }
.item-row--active { color: var(--text-primary); outline: 2px solid var(--accent-blue); outline-offset: -2px; }
.item-row--add { color: var(--accent-blue, #3b82f6); font-size: 0.8rem; }

.item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.item-count {
  font-size: 0.72rem;
  color: var(--text-muted);
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0.1rem 0.4rem;
  flex-shrink: 0;
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
}

.field-input:focus { border-color: var(--accent-blue); }

.item-btns { display: flex; gap: 0.5rem; }

.remove-btn {
  background: none;
  border: 1px solid var(--accent-red);
  border-radius: 5px;
  color: var(--accent-red);
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
}

.remove-btn:hover { background: var(--accent-red); color: #fff; }

.done-btn {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: #9aa3bc;
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
}

.done-btn:hover { background: #313858; }

.no-selection {
  font-size: 0.85rem;
  color: #9aa3bc;
  text-align: center;
  padding: 0.25rem 0;
}

.save-error { font-size: 0.8rem; color: var(--accent-red); }

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
