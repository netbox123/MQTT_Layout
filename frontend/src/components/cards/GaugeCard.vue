<template>
  <div class="card gauge-card">
    <div class="gauge-wrap">
      <div class="gauge-svg-wrap">
        <svg class="gauge-svg" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
          <path class="gauge-track" :d="arcD" />
          <path class="gauge-fill" :d="arcD"
            :stroke="fillColor"
            :stroke-dasharray="`${fillLength} ${arcLength}`"
          />
        </svg>
        <div class="gauge-label">
          <span class="value" :class="{ 'value--null': value === null }">
            {{ value !== null ? value : '—' }}
          </span>
          <span v-if="card.unit" class="unit">{{ card.unit }}</span>
        </div>
      </div>
      <div class="gauge-title">{{ card.title }}</div>
    </div>
  </div>
</template>

<script>
export const icon = '🔢';
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

// Both track and fill share the exact same path — dasharray controls fill length
const arcD = 'M 10 55 A 40 40 0 1 1 90 55';
const arcLength = Math.PI * 40;

const fillRatio = computed(() => {
  if (rawValue.value === null) return 0;
  const min = props.card.min ?? 0;
  const max = props.card.max ?? 100;
  return Math.min(1, Math.max(0, (Number(rawValue.value) - min) / (max - min)));
});

const fillLength = computed(() => fillRatio.value * arcLength);

const fillColor = computed(() => {
  const ratio = fillRatio.value;
  if (ratio < 0.5) return 'var(--accent-green)';
  if (ratio < 0.8) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
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
  gap: 0.25rem;
}

.card:hover { background: var(--bg-card-hover); }

.gauge-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
}

.gauge-svg-wrap {
  position: relative;
  width: 100%;
}

.gauge-svg {
  width: 100%;
  max-height: 70px;
  display: block;
}

.gauge-track {
  fill: none;
  stroke: var(--border);
  stroke-width: 8;
  stroke-linecap: round;
}

.gauge-fill {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dasharray 0.4s ease;
}

.gauge-label {
  position: absolute;
  bottom: 0%;
  left: 0;
  right: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.25rem;
}

.gauge-title {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
  text-align: center;
  width: 100%;
  margin-top: -8px;
}

.value {
  font-size: 1rem;
  font-weight: 400;
  color: var(--text-primary);
}

.value--null { color: var(--text-muted); }

.unit {
  font-size: 0.8rem;
  color: var(--text-secondary);
}
</style>
