<template>
  <div class="card text-card">
    <div class="card-header">{{ card.title }}</div>
    <div class="card-body">
      <span class="text-value" :class="{ 'text-value--null': value === null }">
        {{ value !== null ? value : '—' }}
      </span>
    </div>
  </div>
</template>

<script>
export const icon = '📝';
</script>

<script setup>
import { computed } from 'vue';
import { useMqttStore } from '../../stores/mqttStore.js';

const props = defineProps({
  card: { type: Object, required: true },
});

const mqttStore = useMqttStore();
const value = computed(() => mqttStore.getValue(props.card.mqtt_topic));
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
}

.card:hover { background: var(--bg-card-hover); }

.card-header {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);

  letter-spacing: 0.04em;
}

.card-body {
  flex: 1;
  display: flex;
  align-items: center;
}

.text-value {
  font-size: 1rem;
  color: var(--text-primary);
  word-break: break-word;
}

.text-value--null {
  color: var(--text-muted);
}
</style>
