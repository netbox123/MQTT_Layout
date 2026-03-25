<template>
  <Teleport to="body">
    <div class="picker-backdrop" @click.self="$emit('cancel')">
      <div class="picker-modal">
        <div class="picker-header">
          <input
            ref="searchInput"
            v-model="search"
            class="picker-search"
            placeholder="Search icons…"
            @keydown.escape="$emit('cancel')"
          />
          <button class="picker-close" type="button" @click="$emit('cancel')">✕</button>
        </div>
        <div class="picker-body">
          <template v-for="cat in filtered" :key="cat.label">
            <div class="picker-category">{{ cat.label }}</div>
            <div class="picker-grid">
              <button
                v-for="icon in cat.icons"
                :key="icon.key"
                type="button"
                class="picker-icon"
                :class="{ 'picker-icon--active': icon.key === modelValue }"
                :title="icon.key"
                @click="$emit('update:modelValue', icon.key); $emit('cancel')"
              >
                <svg :viewBox="ICON_VIEWBOXES[icon.key] || '0 0 24 24'" width="22" height="22">
                  <path :d="icon.path" fill="currentColor" />
                </svg>
              </button>
            </div>
          </template>
          <div v-if="filtered.length === 0" class="picker-empty">No icons found</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue';
import { ICON_CATEGORIES, ICON_VIEWBOXES } from '../../utils/pageIcons.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
});
defineEmits(['update:modelValue', 'cancel']);

const search = ref('');
const searchInput = ref(null);

onMounted(() => nextTick(() => searchInput.value?.focus()));

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return ICON_CATEGORIES;
  return ICON_CATEGORIES
    .map(cat => ({ ...cat, icons: cat.icons.filter(i => i.key.includes(q)) }))
    .filter(cat => cat.icons.length > 0);
});
</script>

<style scoped>
.picker-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.picker-modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 360px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.picker-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border);
}

.picker-search {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.875rem;
  padding: 0.4rem 0.65rem;
  font-family: inherit;
  outline: none;
}

.picker-search:focus {
  border-color: var(--accent-blue);
}

.picker-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  transition: color 0.15s;
}

.picker-close:hover {
  color: var(--text-primary);
}

.picker-body {
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.picker-category {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  padding: 0.25rem 0 0.1rem;
}

.picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.picker-icon {
  width: 36px;
  height: 36px;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}

.picker-icon:hover {
  background: var(--bg-card);
  border-color: var(--border);
  color: var(--text-primary);
}

.picker-icon--active {
  background: var(--bg-card);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.picker-empty {
  font-size: 0.85rem;
  color: var(--text-muted);
  text-align: center;
  padding: 1.5rem 0;
}
</style>
