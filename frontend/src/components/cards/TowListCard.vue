<template>
  <div class="card towlist-card">
    <div class="towlist-header">
      <nav class="towlist-tabs">
        <button
          v-for="year in allYears"
          :key="year"
          class="towlist-tab"
          :class="{ 'towlist-tab--active': year === activeYear }"
          @click="activeYear = year"
        >{{ year }}</button>
      </nav>
      <button
        class="towlist-download"
        :disabled="syncing"
        :title="syncError ? syncMessage : 'Download saved tows from the winch SD card'"
        @click="downloadTows"
      >
        <svg class="towlist-download-icon" :class="{ 'towlist-download-icon--spinning': syncing }" viewBox="0 0 24 24">
          <path :d="mdiDownload" fill="currentColor" />
        </svg>
      </button>
    </div>
    <div v-if="syncMessage" class="towlist-sync-message" :class="{ 'towlist-sync-message--error': syncError }">{{ syncMessage }}</div>
    <div class="towlist-list">
      <div
        v-for="tow in filteredTows"
        :key="tow.id"
        class="towlist-row"
        :class="{ 'towlist-row--active': tow.id === store.selectedId }"
        @click="store.select(tow.id)"
      >
        <svg class="towlist-icon" viewBox="0 0 24 24"><path :d="mdiLinkVariant" fill="currentColor" /></svg>
        <span class="towlist-name">{{ formatLabel(tow) }}</span>
      </div>
      <div v-if="!filteredTows.length" class="towlist-empty">No tows logged yet</div>
    </div>
  </div>
</template>

<script>
export const icon = '📋';
</script>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { mdiLinkVariant, mdiDownload } from '@mdi/js';
import { useTowStore } from '../../stores/towStore.js';

const props = defineProps({ card: { type: Object, required: true } });

const store = useTowStore();
onMounted(() => store.load());

// Same /api/giga-sync/pull the GIGA Boot Config modal's own "From winch"
// button uses (see GigaBootConfigModal.vue's pullFromWinch) - this is just
// a shortcut placed contextually right on the tow list itself, so pulling
// newly-saved tows off the winch's SD card doesn't require opening that
// modal first.
const syncing = ref(false);
const syncMessage = ref('');
const syncError = ref(false);

async function downloadTows() {
  syncing.value = true;
  syncMessage.value = '';
  syncError.value = false;
  try {
    const res = await fetch('/api/giga-sync/pull', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'pull failed');
    syncMessage.value = `Imported ${data.towsImported} tow(s), ${data.towsSkipped} already had a matching name.`;
    if (data.towsImported > 0) await store.refresh();
  } catch (err) {
    syncError.value = true;
    syncMessage.value = err.message;
  } finally {
    syncing.value = false;
  }
}

const allYears = computed(() => {
  const set = new Set([...(props.card.years ?? []), ...store.years]);
  return [...set].sort();
});

const activeYear = ref('');
watch(allYears, (years) => {
  if (!activeYear.value && years.length) activeYear.value = years[years.length - 1];
}, { immediate: true });

const filteredTows = computed(() =>
  store.tows
    .filter(t => (t.date ?? '').slice(0, 4) === activeYear.value)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
);

function formatLabel(tow) {
  const d = new Date(tow.date);
  const date = isNaN(d) ? tow.date : `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return tow.pilot ? `${date} ${tow.pilot}` : date;
}
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

.towlist-header {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.towlist-tabs {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  flex: 1;
  min-width: 0;
}

.towlist-tabs::-webkit-scrollbar { display: none; }

.towlist-download {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  background: none;
  border: none;
  border-left: 1px solid var(--border);
  color: var(--text-secondary);
  cursor: pointer;
}

.towlist-download:hover:not(:disabled) { color: var(--text-primary); background: var(--bg-card-hover); }

.towlist-download:disabled { cursor: default; opacity: 0.6; }

.towlist-download-icon { width: 15px; height: 15px; }

.towlist-download-icon--spinning { animation: towlist-spin 1s linear infinite; }

@keyframes towlist-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.towlist-sync-message {
  font-size: 0.7rem;
  color: var(--text-muted);
  padding: 0.3rem 0.6rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.towlist-sync-message--error { color: var(--accent-red); }

.towlist-tab {
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

.towlist-tab--active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-yellow);
}

.towlist-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 4px;
}

.towlist-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.6rem;
  height: 2rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}

.towlist-row:last-of-type { border-bottom: none; }

.towlist-row:hover { background: var(--bg-card-hover); }

.towlist-row--active {
  background: var(--bg-card-hover);
}

.towlist-row--active .towlist-name {
  color: var(--accent-yellow);
}

.towlist-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--text-muted);
}

.towlist-name {
  flex: 1;
  font-size: 0.78rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.towlist-empty {
  padding: 0.75rem 0.6rem;
  font-size: 0.78rem;
  color: var(--text-muted);
}
</style>
