<template>
  <div class="battery-page">

    <div class="tab-bar">
      <button
        v-for="g in groups"
        :key="g.name"
        class="tab-btn"
        :class="{ 'tab-btn--active': activeGroup === g.name }"
        @click="selectGroup(g.name)"
      >{{ g.name }}</button>
    </div>

    <div v-if="currentGroup" class="tab-bar tab-bar--sub">
      <button
        v-for="p in currentGroup.packs"
        :key="p.name"
        class="tab-btn tab-btn--sub"
        :class="{ 'tab-btn--active': activePack === p.name }"
        @click="activePack = p.name"
      >{{ p.name }}</button>
    </div>

    <div v-if="currentPack" class="pack-view">

      <div class="summary-row">
        <div class="summary-item">
          <span class="summary-label">Total</span>
          <span class="summary-value">{{ packData ? packData.total_voltage.toFixed(2) + ' V' : '—' }}</span>
        </div>
        <div class="summary-divider" />
        <div class="summary-item">
          <span class="summary-label">Delta</span>
          <span class="summary-value" :class="deltaClass">{{ validDelta !== null ? (validDelta * 1000).toFixed(0) + ' mV' : '—' }}</span>
        </div>
        <div class="summary-divider" />
        <div class="summary-item">
          <span class="summary-label">Min cell</span>
          <span class="summary-value cell-min">{{ validMin !== null ? validMin.toFixed(4) + ' V' : '—' }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Max cell</span>
          <span class="summary-value cell-max">{{ validMax !== null ? validMax.toFixed(4) + ' V' : '—' }}</span>
        </div>
        <div class="summary-divider" />
        <div class="summary-item">
          <span class="summary-label">Temp</span>
          <span class="summary-value">{{ packData ? packData.temp1.toFixed(1) + ' °C' : '—' }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Updated</span>
          <span class="summary-value">{{ lastUpdated ?? '—' }}</span>
        </div>
      </div>

      <div v-if="packData" class="cell-grid" :style="{
        gap: (pageConfig.grid_spacing ?? 8) + 'px',
        gridTemplateColumns: `repeat(auto-fill, ${pageConfig.card_width ?? 150}px)`,
        gridAutoRows: pageConfig.card_height ? pageConfig.card_height + 'px' : undefined,
      }">
        <div
          v-for="(c, i) in cells"
          :key="i"
          class="cell"
          :style="{ '--accent': i === minCellIndex ? '#3b82f6' : i === maxCellIndex ? '#ef4444' : 'var(--border)' }"
          :title="`Cell ${i + 1}: ${c.valid ? c.value + ' V' : 'NA'}`"
        >
          <span class="cell-num">Cell {{ i + 1 }}</span>
          <div class="cell-voltage" :class="{
            'cell-v--min': i === minCellIndex,
            'cell-v--max': i === maxCellIndex,
            'cell-v--na': !c.valid,
          }">
            <span class="cell-v">{{ c.valid ? c.value.toFixed(4) : 'NA' }}</span>
            <span class="cell-unit" v-if="c.valid">V</span>
          </div>
        </div>
      </div>

      <div v-else class="waiting">Waiting for data…</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useMqttStore } from '../stores/mqttStore.js';

const props = defineProps({
  pageConfig: { type: Object, required: true },
});

const mqttStore = useMqttStore();
const groups = computed(() => props.pageConfig.groups ?? []);

const activeGroup = ref(groups.value[0]?.name ?? '');
const activePack  = ref(groups.value[0]?.packs[0]?.name ?? '');

function selectGroup(name) {
  activeGroup.value = name;
  const g = groups.value.find(g => g.name === name);
  activePack.value = g?.packs[0]?.name ?? '';
}

const currentGroup = computed(() => groups.value.find(g => g.name === activeGroup.value));
const currentPack  = computed(() => currentGroup.value?.packs.find(p => p.name === activePack.value));

const packData = computed(() => {
  if (!currentPack.value) return null;
  const raw = mqttStore.getValue(currentPack.value.topic);
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { return null; }
});

const cells = computed(() => {
  if (!packData.value) return [];
  return packData.value.cells.map(v => ({ value: v, valid: v > 2.5 && v < 4.5 }));
});

const validCells = computed(() => cells.value.filter(c => c.valid).map(c => c.value));

const validMin   = computed(() => validCells.value.length ? Math.min(...validCells.value) : null);
const validMax   = computed(() => validCells.value.length ? Math.max(...validCells.value) : null);
const validDelta = computed(() => (validMin.value !== null && validMax.value !== null) ? validMax.value - validMin.value : null);

const minCellIndex = computed(() => {
  if (validMin.value === null) return -1;
  return cells.value.findIndex(c => c.valid && c.value === validMin.value);
});

const maxCellIndex = computed(() => {
  if (validMax.value === null) return -1;
  return cells.value.findIndex(c => c.valid && c.value === validMax.value);
});

const lastUpdatedMap = ref({});
watch(
  () => currentPack.value?.topic && mqttStore.getValue(currentPack.value.topic),
  (val) => {
    if (val && currentPack.value?.topic) {
      const now = new Date();
      lastUpdatedMap.value[currentPack.value.topic] =
        now.toTimeString().slice(0, 8);
    }
  }
);
const lastUpdated = computed(() =>
  currentPack.value ? (lastUpdatedMap.value[currentPack.value.topic] ?? null) : null
);

const deltaClass = computed(() => {
  if (validDelta.value === null) return '';
  const mv = validDelta.value * 1000;
  if (mv > 100) return 'delta--danger';
  if (mv > 50)  return 'delta--warn';
  return '';
});

</script>

<style scoped>
.battery-page {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  box-sizing: border-box;
}

/* ── Tabs ──────────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--border);
}

.tab-btn {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.5rem 1.25rem;
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn:hover { color: var(--text-primary); }

.tab-btn--active {
  color: var(--accent-blue);
  border-bottom-color: var(--accent-blue);
}

.tab-btn--sub {
  font-size: 0.82rem;
  padding: 0.35rem 1rem;
}

/* ── Pack view ─────────────────────────────────────────────── */
.pack-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
}

/* ── Summary ───────────────────────────────────────────────── */
.summary-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding: 0.85rem 1.25rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.summary-divider {
  width: 1px;
  height: 2rem;
  background: var(--border);
  flex-shrink: 0;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.summary-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.summary-value {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.cell-min { color: #60a5fa; }
.cell-max { color: #f87171; }
.delta--warn   { color: #f59e0b; }
.delta--danger { color: var(--accent-red); }

/* ── Cell grid ─────────────────────────────────────────────── */
.cell-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 150px);
  gap: 8px;
}

.cell {
  border-radius: 8px;
  padding: 0.65rem 0.5rem 0.55rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.08rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-top: 3px solid var(--accent, var(--border));
  min-width: 0;
  box-sizing: border-box;
  position: relative;
  transition: border-top-color 0.4s ease;
}

.cell-num {
  position: absolute;
  top: 0.55rem;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1;
}

.cell-voltage {
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
  color: var(--text-primary);
}

.cell-v {
  font-size: 1.1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.cell-unit {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1;
}

.cell-v--min { color: #60a5fa; }
.cell-v--max { color: #f87171; }
.cell-v--na  { color: var(--text-muted); font-style: italic; }

.waiting {
  color: var(--text-muted);
  font-style: italic;
  padding: 2rem;
  text-align: center;
}
</style>
