<template>
  <div class="card kvm-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiMonitorShare" /></svg>
      {{ card.title || 'KVM Switch' }}
    </div>
    <div class="input-row">
      <button
        v-for="(inp, i) in inputs"
        :key="i"
        class="input-btn"
        :class="{ 'input-btn--active': activeIndex === i + 1, 'input-btn--busy': busyIndex === i + 1 }"
        :disabled="busyIndex !== null || !inp.command_topic"
        @click="select(i + 1, inp)"
      >{{ inp.label || `Input ${i + 1}` }}</button>
    </div>
  </div>
</template>

<script>
export const icon = '🖥️';
export const label = 'KVM Switch';

// Relays on shed8b wired to the KVM's input buttons (user's mapping).
export const DEFAULT_INPUTS = [
  { label: 'Input 1', command_topic: 'esp32/switch/shed8b-light7/command' },
  { label: 'Input 2', command_topic: 'esp32/switch/shed8b-light5/command' },
  { label: 'Input 3', command_topic: 'esp32/switch/shed8b-light6/command' },
  { label: 'Input 4', command_topic: 'esp32/switch/shed8b-light8/command' },
];
</script>

<script setup>
import { ref, computed } from 'vue';
import { mdiMonitorShare } from '@mdi/js';
import { useMqttStore } from '../../stores/mqttStore.js';
import { useMqtt } from '../../composables/useMqtt.js';

const props = defineProps({
  card: { type: Object, required: true },
});

const mqttStore = useMqttStore();
const { publish } = useMqtt();

const inputs = computed(() =>
  DEFAULT_INPUTS.map((def, i) => ({ ...def, ...(props.card.inputs?.[i] ?? {}) }))
);

// The KVM can't report its input, so the last selection is kept as a retained
// MQTT message (card.mqtt_topic) and shared by every screen.
const optimistic = ref(null);
const activeIndex = computed(() => {
  if (optimistic.value !== null) return optimistic.value;
  const v = parseInt(mqttStore.getValue(props.card.mqtt_topic));
  return Number.isInteger(v) ? v : null;
});

const busyIndex = ref(null);

function select(n, inp) {
  const topic = inp.command_topic?.trim();
  if (!topic || busyIndex.value !== null) return;
  busyIndex.value = n;
  optimistic.value = n;
  // Short press on the KVM's input button: relay ON, then OFF.
  publish(topic, 'ON');
  setTimeout(() => {
    publish(topic, 'OFF');
    busyIndex.value = null;
  }, props.card.pulse_ms ?? 300);
  if (props.card.mqtt_topic) publish(props.card.mqtt_topic, String(n), { retain: true });
  setTimeout(() => { optimistic.value = null; }, 3000);
}
</script>

<style scoped>
.kvm-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.65rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow: hidden;
}

.card-header {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.header-icon { width: 13px; height: 13px; flex-shrink: 0; }

/* Same buttons as the WiiM card's input row */
.input-row {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.575rem;
}

.input-btn {
  font-size: 0.62rem;
  font-family: inherit;
  font-weight: 600;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.input-btn:hover:not(:disabled) { border-color: #5090d0; color: #5090d0; }
.input-btn:disabled { cursor: default; }
.input-btn--active {
  background: #1c2a40;
  border-color: #5090d0;
  color: #fff;
}
.input-btn--busy { opacity: 0.7; }
</style>
