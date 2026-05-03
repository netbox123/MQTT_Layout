<template>
  <div class="card wled-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiLightbulbGroup" /></svg>
      {{ card.title || 'WLED' }}
    </div>
    <div v-if="!cardDevices.length" class="empty-msg">No devices</div>
    <div v-else class="device-list">
      <div v-for="d in cardDevices" :key="d.id" class="device-row">
        <button
          class="bulb-btn"
          :class="{ 'bulb-btn--on': isOn(d) }"
          :disabled="!isOnline(d)"
          :title="isOn(d) ? 'Turn off' : 'Turn on'"
          @click="toggle(d)"
        >
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path :d="isOn(d) ? mdiLightbulb : mdiLightbulbOutline" :fill="bulbColor(d)" />
          </svg>
        </button>
        <span class="device-name">{{ deviceName(d.id) }}</span>
        <span class="dot" :class="isOnline(d) ? 'dot--on' : 'dot--off'"></span>
      </div>
    </div>
  </div>
</template>

<script>
export const icon = '💡';
</script>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue';
import { mdiLightbulb, mdiLightbulbOutline, mdiLightbulbGroup } from '@mdi/js';
import { useMqttStore } from '../../stores/mqttStore.js';
import { useMqtt } from '../../composables/useMqtt.js';

const props = defineProps({ card: { type: Object, required: true } });

const mqttStore = useMqttStore();
const { publish } = useMqtt();

const wledDevices = ref([]);
onMounted(async () => {
  try {
    const res = await fetch('/api/wled-devices');
    if (res.ok) wledDevices.value = await res.json();
  } catch { /* ignore */ }
});

const cardDevices = computed(() => props.card.devices ?? []);

function deviceName(id) {
  return wledDevices.value.find(d => d.id === id)?.name ?? id;
}

function isOnline(d) {
  return mqttStore.topicValues[`wled/${d.id}/status`] === 'online';
}

// Optimistic on/off state — WLED keeps /g at last brightness when turned off,
// so we can't rely on it. Track state locally after first click.
const localOnState = reactive({});

function isOn(d) {
  if (d.id in localOnState) return localOnState[d.id];
  const g = mqttStore.topicValues[`wled/${d.id}/g`];
  return g !== undefined && parseInt(g) > 0;
}

function bulbColor(d) {
  if (!isOn(d) || !isOnline(d)) return '#3a3a3a';
  const p = d.preset;
  if (!p) return '#f5c518';
  const r = Math.min(255, (p.r ?? 0) + (p.w ?? 0));
  const g = Math.min(255, (p.g ?? 0) + (p.w ?? 0));
  const b = Math.min(255, (p.b ?? 0) + (p.w ?? 0));
  const lum = r * 0.299 + g * 0.587 + b * 0.114;
  return lum < 30 ? '#f5c518' : `rgb(${r}, ${g}, ${b})`;
}

function toggle(d) {
  const on = isOn(d);
  localOnState[d.id] = !on;
  if (on) {
    publish(`wled/${d.id}/api`, JSON.stringify({ on: false }));
  } else {
    const { r = 255, g = 255, b = 255, w = 0 } = d.preset ?? {};
    publish(`wled/${d.id}/api`, JSON.stringify({
      on: true,
      bri: 255,
      seg: [{ col: [[r, g, b, w]] }],
    }));
  }
}
</script>

<style scoped>
.wled-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.65rem 0.4rem;
  display: flex;
  flex-direction: column;
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
  margin-bottom: 0.25rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.header-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.empty-msg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: #9aa3bc;
}

.device-list {
  flex: 1;
  overflow-y: auto;
  margin: 0 -0.65rem;
}

.device-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.2rem 0.65rem;
}
.device-row:hover { background: var(--bg-card-hover); }

.bulb-btn {
  background: none;
  border: none;
  padding: 0.2rem;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}
.bulb-btn:hover:not(:disabled) { background: rgba(255,255,255,0.06); }
.bulb-btn:disabled { cursor: default; opacity: 0.4; }
.bulb-btn--on svg { filter: drop-shadow(0 0 4px currentColor); }

.device-name {
  flex: 1;
  font-size: 0.8rem;
  color: #e8eaf0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--on  { background: #4caf6e; }
.dot--off { background: #e05454; }
</style>
