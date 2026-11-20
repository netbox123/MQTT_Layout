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
import { useMqtt } from '../../composables/useMqtt.js';
import { ICON_MAP } from '../../utils/pageIcons.js';

const props = defineProps({
  card: { type: Object, required: true },
});

const mqttStore = useMqttStore();
const { publish } = useMqtt();

const rawValue = computed(() => mqttStore.getValue(props.card.mqtt_topic));
// ESPHome's native MQTT light state payload is JSON (e.g. {"state":"ON",...});
// switches/binary_sensors/HA statestream publish plain "ON"/"OFF" text.
const stateValue = computed(() => {
  const v = rawValue.value;
  if (typeof v === 'string' && v.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(v);
      if (typeof parsed.state === 'string') return parsed.state;
    } catch { /* not JSON, use raw value */ }
  }
  return v;
});
const isOn = computed(() => {
  const v = stateValue.value;
  if (v === null) return false;
  return v === true || v === 1 || String(v).toLowerCase() === 'on' || String(v) === '1';
});

function toggle() {
  const cmdTopic = props.card.command_topic?.trim();
  if (!cmdTopic) return;
  const next = isOn.value ? 'off' : 'on';
  const payload = cmdTopic.includes('/light/')
    ? JSON.stringify({ state: next.toUpperCase() })
    : next.toUpperCase();
  publish(cmdTopic, payload);
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
  color: var(--text-primary);
  letter-spacing: 0.04em;
  text-align: center;
  width: 100%;
}
</style>
