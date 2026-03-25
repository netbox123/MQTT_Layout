<template>
  <div class="card switch-card" :class="{ 'switch-card--on': isOn }" @click="toggle">
    <div class="switch-wrap">
      <svg v-if="card.icon && ICON_MAP[card.icon]" class="switch-icon" :class="{ 'switch-icon--on': isOn }" viewBox="0 0 24 24">
        <path :d="ICON_MAP[card.icon]" fill="currentColor" />
      </svg>
    </div>
    <div class="switch-title">{{ card.title }}</div>
  </div>
</template>

<script>
export const icon = '💡';
</script>

<script setup>
import { computed } from 'vue';
import { useMqttStore } from '../../stores/mqttStore.js';
import { ICON_MAP } from '../../utils/pageIcons.js';

const props = defineProps({
  card: { type: Object, required: true },
});

const mqttStore = useMqttStore();

const rawValue = computed(() => mqttStore.getValue(props.card.mqtt_topic));
const isOn = computed(() => {
  const v = rawValue.value;
  if (v === null) return false;
  return v === true || v === 1 || String(v).toLowerCase() === 'on' || String(v) === '1';
});

function toggle() {
  const next = isOn.value ? 'off' : 'on';
  const domain = props.card.ha_entity_id?.split('.')[0] ?? 'switch';
  fetch(`/api/ha/service/${domain}/turn_${next}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_id: props.card.ha_entity_id }),
  }).catch(err => console.error('[HA] Toggle failed:', err));
}
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.card:hover { background: var(--bg-card-hover); }

.switch-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.switch-icon {
  width: 60%;
  height: 60%;
  max-width: 80px;
  max-height: 80px;
  color: var(--text-muted);
  transition: color 0.2s;
}

.switch-icon--on {
  color: var(--accent-yellow);
}

.switch-title {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
  text-align: center;
  width: 100%;
}
</style>
