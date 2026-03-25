<template>
  <div class="card entities-card">
    <div
      v-for="(item, i) in card.items ?? []"
      :key="i"
      class="entity-row"
      :class="{ 'entity-row--last': i === (card.items ?? []).length - 1 }"
    >
      <svg v-if="item.icon && ICON_MAP[item.icon]" class="entity-icon" viewBox="0 0 24 24">
        <path :d="ICON_MAP[item.icon]" fill="currentColor" />
      </svg>
      <span class="entity-title">{{ item.title }}</span>
      <span class="entity-value-group">
        <span class="entity-value">{{ getValue(item) }}</span><span v-if="item.unit" class="entity-unit">{{ item.unit }}</span>
      </span>
    </div>
  </div>
</template>

<script>
export const icon = '☰';
</script>

<script setup>
import { useMqttStore } from '../../stores/mqttStore.js';
import { ICON_MAP } from '../../utils/pageIcons.js';

const props = defineProps({
  card: { type: Object, required: true },
});

const mqttStore = useMqttStore();

function getValue(item) {
  const v = mqttStore.getValue(item.mqtt_topic);
  if (v === null) return '—';
  return String(v);
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

.entity-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.6rem;
  flex: 1;
  min-height: 0;
  border-bottom: 1px solid var(--border);
}

.entity-row--last {
  border-bottom: none;
}

.entity-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-muted);
}

.entity-title {
  flex: 1;
  font-size: 0.78rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entity-value {
  font-size: 0.78rem;
  color: var(--text-primary);
  white-space: nowrap;
}

.entity-value-group {
  white-space: nowrap;
}

.entity-unit {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-left: 0.2rem;
}
</style>
