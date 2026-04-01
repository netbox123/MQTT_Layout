<template>
  <div class="card url-card">
    <div class="url-header">
      <nav class="url-tabs">
        <button
          v-for="cat in categories"
          :key="cat.name"
          class="url-tab"
          :class="{ 'url-tab--active': cat.name === activeCategory }"
          @click="activeCategory = cat.name"
        >{{ cat.name }}</button>
      </nav>
    </div>
    <div class="url-list">
      <div
        v-for="(item, idx) in filteredUrls"
        :key="item.name + idx"
        class="url-row"
      >
        <svg class="url-icon" viewBox="0 0 24 24"><path :d="mdiLinkVariant" fill="currentColor" /></svg>
        <a class="url-name" :href="item.url" target="_blank" rel="noopener">{{ item.name }}</a>
        <button v-if="editing" class="url-edit-btn" @click.prevent="openEdit(item)">
          <svg viewBox="0 0 24 24" width="13" height="13"><path :d="mdiPencil" fill="currentColor" /></svg>
        </button>
        <svg v-else class="url-open" viewBox="0 0 24 24"><path :d="mdiOpenInNew" fill="currentColor" /></svg>
      </div>
      <div v-if="filteredUrls.length === 0" class="url-empty">No links</div>
    </div>

    <!-- Inline URL edit dialog -->
    <Teleport to="body">
      <div v-if="dialog" class="dialog-backdrop" @click.self="dialog = null">
        <div class="dialog">
          <h3 class="dialog-title">{{ dialog.isNew ? 'Add Link' : 'Edit Link' }}</h3>
          <div class="fields">
            <label class="field-label">name</label>
            <input class="field-input" v-model="dialog.name" />
            <label class="field-label">url</label>
            <input class="field-input" v-model="dialog.url" />
            <label class="field-label">category</label>
            <select class="field-input" v-model="dialog.category">
              <option v-for="cat in categories" :key="cat.name" :value="cat.name">{{ cat.name }}</option>
            </select>
            <label class="field-label">order</label>
            <input class="field-input" type="number" min="0" v-model.number="dialog.order" />
          </div>
          <div class="dialog-actions">
            <button v-if="!dialog.isNew" class="dialog-delete" @click="deleteUrl">Delete</button>
            <span v-else></span>
            <div class="dialog-actions-right">
              <button class="dialog-cancel" @click="dialog = null">Cancel</button>
              <button class="dialog-confirm" @click="saveUrl">OK</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
export const icon = '🔗';
</script>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, defineExpose } from 'vue';
import { mdiLinkVariant, mdiOpenInNew, mdiPencil } from '@mdi/js';

const props = defineProps({ card: Object });
const editing = inject('editing', ref(false));

const allCategories = ref([]);
const allUrls = ref([]);
const activeCategory = ref('');
const dialog = ref(null);

async function fetchUrls() {
  try {
    const res = await fetch('/api/urls');
    if (!res.ok) return;
    const data = await res.json();
    allCategories.value = [...(data.categories ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    allUrls.value = data.urls ?? [];
    if (!activeCategory.value || !allCategories.value.find(c => c.name === activeCategory.value)) {
      activeCategory.value = allCategories.value[0]?.name ?? '';
    }
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchUrls();
  window.addEventListener('urls-updated', fetchUrls);
});
onUnmounted(() => window.removeEventListener('urls-updated', fetchUrls));

const categories = computed(() => allCategories.value);

const filteredUrls = computed(() =>
  allUrls.value
    .filter(u => u.category === activeCategory.value)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
);

function openEdit(item) {
  dialog.value = { ...item, isNew: false, _original: item };
}

function openAdd() {
  dialog.value = { name: '', url: '', category: activeCategory.value, order: filteredUrls.value.length, isNew: true };
}

async function saveUrl() {
  const updated = [...allUrls.value];
  if (dialog.value.isNew) {
    updated.push({ name: dialog.value.name, url: dialog.value.url, category: dialog.value.category, order: dialog.value.order });
  } else {
    const idx = updated.indexOf(dialog.value._original);
    if (idx !== -1) updated[idx] = { name: dialog.value.name, url: dialog.value.url, category: dialog.value.category, order: dialog.value.order };
  }
  await patchUrls(updated);
  dialog.value = null;
}

async function deleteUrl() {
  const updated = allUrls.value.filter(u => u !== dialog.value._original);
  await patchUrls(updated);
  dialog.value = null;
}

async function patchUrls(urls) {
  try {
    await fetch('/api/urls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: allCategories.value, urls }),
    });
    window.dispatchEvent(new CustomEvent('urls-updated'));
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

.url-header {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.url-tabs {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  flex: 1;
  min-width: 0;
}

.url-tabs::-webkit-scrollbar { display: none; }

.url-tab {
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

.url-tab--active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-blue, #3b82f6);
}


.url-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 4px;
}


.url-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.6rem;
  height: 2rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.url-row:last-of-type { border-bottom: none; }

.url-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--text-muted);
}

.url-name {
  flex: 1;
  font-size: 0.78rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: none;
}

.url-name:hover { color: var(--text-primary); }

.url-open {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.1s;
}

.url-row:hover .url-open { opacity: 1; }

.url-edit-btn {
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

.url-edit-btn:hover { color: var(--accent-blue); background: var(--bg-base); }

.url-empty {
  padding: 0.75rem 0.6rem;
  font-size: 0.78rem;
  color: var(--text-muted);
}

/* Inline dialog */
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
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-title {
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
