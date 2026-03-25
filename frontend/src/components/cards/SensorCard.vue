<template>
  <div class="card sensor-card">
    <div class="card-header">{{ card.title }}</div>
    <div class="card-value">
      <span class="value" :class="{ 'value--null': value === null }">
        {{ value !== null ? value : '—' }}
      </span>
      <span v-if="card.unit" class="unit">{{ card.unit }}</span>
    </div>
  </div>
</template>

<script>
export const icon = '📡';
</script>

<script setup>
import { computed } from 'vue';
import { useMqttStore } from '../../stores/mqttStore.js';

const props = defineProps({
  card: { type: Object, required: true },
});

const mqttStore = useMqttStore();
const rawValue = computed(() => mqttStore.getValue(props.card.mqtt_topic));
const value = computed(() => {
  if (rawValue.value === null) return null;
  const num = Number(rawValue.value);
  return isNaN(num) ? rawValue.value : num.toFixed(props.card.round ?? 1);
});
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: background 0.15s;
}

.card:hover {
  background: var(--bg-card-hover);
}

.card-header {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);

  letter-spacing: 0.04em;
}

.card-value {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  flex: 1;
}

.value {
  font-size: 1.8rem;
  font-weight: 400;
  color: var(--text-primary);
  line-height: 1;
}

.value--null {
  color: var(--text-muted);
}

.unit {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
</style>
