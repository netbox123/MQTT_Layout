<template>
  <div class="card grid-card">
    <div
      class="grid-inner"
      :style="{ gridTemplateColumns: `repeat(${effectiveCols}, 1fr)`, gridTemplateRows: `repeat(${effectiveRows}, 1fr)` }"
    >
      <div
        v-for="(item, i) in card.items ?? []"
        :key="i"
        class="grid-item"
        :class="{ 'grid-item--sensor': item.type === 'sensor', 'grid-item--switch': item.type === 'switch', 'grid-item--on': (item.type === 'switch' || item.type === 'indicator') && isOn(item) }"
        :style="{ gridColumn: (item.col ?? 0) + 1, gridRow: (item.row ?? 0) + 1 }"
        @click="item.type === 'switch' ? toggle(item) : undefined"
      >
        <template v-if="item.type === 'gauge'">
          <div class="item-gauge-wrap">
            <div class="item-gauge-arc-wrap">
              <svg class="item-gauge-svg" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
                <path class="item-gauge-track" d="M 10 55 A 40 40 0 1 1 90 55" />
                <path class="item-gauge-fill" d="M 10 55 A 40 40 0 1 1 90 55"
                  :stroke="gaugeColor(item)"
                  :stroke-dasharray="`${gaugeLength(item)} ${arcLength}`"
                />
              </svg>
              <div class="item-gauge-label">
                <span class="item-value">{{ itemValue(item) }}</span>
                <span v-if="item.unit" class="item-unit">{{ item.unit }}</span>
              </div>
            </div>
            <span class="item-title">{{ item.title }}</span>
          </div>
        </template>
        <template v-else-if="item.type === 'sensor'">
          <span class="item-title">{{ item.title }}</span>
          <div class="item-sensor-value">
            <div class="item-sensor-number">
              <span class="item-value-large">{{ itemValue(item) }}</span>
              <span v-if="item.unit" class="item-unit">{{ item.unit }}</span>
            </div>
          </div>
        </template>
        <template v-else>
          <svg v-if="item.icon && ICON_MAP[item.icon]" class="item-icon" :class="{ 'item-icon--on': (item.type === 'switch' || item.type === 'indicator') && isOn(item) }" viewBox="0 0 24 24">
            <path :d="ICON_MAP[item.icon]" fill="currentColor" />
          </svg>
          <span class="item-title">{{ item.title }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
export const icon = '▤';
</script>

<script setup>
import { computed } from 'vue';
import { useMqttStore } from '../../stores/mqttStore.js';
import { ICON_MAP } from '../../utils/pageIcons.js';

const props = defineProps({
  card: { type: Object, required: true },
});

const effectiveCols = computed(() => {
  const items = props.card.items ?? [];
  return Math.max(props.card.cols ?? props.card.position?.w ?? 2, ...items.map(i => (i.col ?? 0) + 1), 1);
});

const effectiveRows = computed(() => {
  const items = props.card.items ?? [];
  return Math.max(props.card.rows ?? props.card.position?.h ?? 2, ...items.map(i => (i.row ?? 0) + 1), 1);
});

const mqttStore = useMqttStore();

function rawVal(item) {
  return mqttStore.getValue(item.mqtt_topic);
}

function isOn(item) {
  const v = rawVal(item);
  if (v === null) return false;
  return v === true || v === 1 || String(v).toLowerCase() === 'on' || String(v) === '1';
}

function itemValue(item) {
  if (item.type === 'switch') return isOn(item) ? 'On' : 'Off';
  const v = rawVal(item);
  if (v === null) return '—';
  const num = Number(v);
  if (!isNaN(num)) return num.toFixed(item.round ?? 1);
  return String(v);
}


const arcLength = Math.PI * 40;

function gaugeRatio(item) {
  const v = rawVal(item);
  if (v === null) return 0;
  const min = item.min ?? 0;
  const max = item.max ?? 100;
  return Math.min(1, Math.max(0, (Number(v) - min) / (max - min)));
}

function gaugeLength(item) {
  return gaugeRatio(item) * arcLength;
}

function gaugeColor(item) {
  const r = gaugeRatio(item);
  if (r < 0.5) return 'var(--accent-green)';
  if (r < 0.8) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}

function toggle(item) {
  const next = isOn(item) ? 'off' : 'on';
  const entityId = item.ha_entity_id?.trim();
  if (!entityId) return;
  const domain = entityId.split('.')[0] || 'switch';
  fetch(`/api/ha/service/${domain}/turn_${next}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_id: entityId }),
  }).catch(err => console.error('[Grid] HA Toggle failed:', err));
}
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
}

.grid-inner {
  display: grid;
  flex: 1;
  min-height: 0;
  gap: 0.4rem;
}

.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: default;
  overflow: hidden;
}

.grid-item--sensor {
  align-items: flex-start;
  justify-content: flex-start;
  padding: 0.4rem 0.5rem;
}

.grid-item--switch {
  cursor: pointer;
}

.item-icon {
  width: 40%;
  height: 40%;
  max-width: 36px;
  max-height: 36px;
  flex-shrink: 0;
  color: var(--text-muted);
  transition: color 0.2s;
}

.item-icon--on {
  color: var(--accent-yellow);
}

.item-gauge-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.item-gauge-arc-wrap {
  position: relative;
  width: 100%;
}

.item-gauge-svg {
  width: 100%;
  display: block;
}

.item-gauge-track {
  fill: none;
  stroke: var(--border);
  stroke-width: 8;
  stroke-linecap: round;
}

.item-gauge-fill {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dasharray 0.4s ease;
}

.item-gauge-label {
  position: absolute;
  bottom: 3px;
  left: 0;
  right: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.15rem;
}

.item-sensor-value {
  display: flex;
  align-items: center;
  flex: 1;
}

.item-sensor-number {
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
}

.item-value-large {
  font-size: 1.4rem;
  font-weight: 400;
  color: var(--text-primary);
  line-height: 1;
}

.item-unit {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.item-title {
  font-size: 0.7rem;
  color: #9aa3bc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.item-value {
  font-size: 1.1rem;
  font-weight: 400;
  color: var(--text-primary);
  white-space: nowrap;
}
</style>
