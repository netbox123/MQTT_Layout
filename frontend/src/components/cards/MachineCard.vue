<template>
  <div class="card machine-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiDesktopClassic" /></svg>
      {{ card.title || 'Machines' }}
    </div>
    <div v-if="!devices.length" class="empty-msg">No data yet</div>
    <div v-else class="device-list">
      <div v-for="d in devices" :key="d.id" class="device-row">
        <span class="dot" :class="d.online ? 'dot--on' : 'dot--off'"></span>
        <span class="device-name">{{ d.name }}</span>
        <span class="device-meta">{{ d.ip }}</span>
        <button class="action-btn action-btn--wake" title="Wake on LAN" :disabled="d.online" @click.stop="wake(d.id)">Wake</button>
        <button class="action-btn action-btn--off" title="Shutdown" :disabled="!d.online" @click.stop="shutdown(d.id)">Off</button>
      </div>
    </div>
  </div>
</template>

<script>
export const icon = '🖥️';
</script>

<script setup>
import { computed } from 'vue';
import { mdiDesktopClassic } from '@mdi/js';
import { useMqttStore } from '../../stores/mqttStore.js';
import { useMqtt } from '../../composables/useMqtt.js';

const props = defineProps({
  card: { type: Object, required: true },
});

const mqttStore = useMqttStore();
const { publish } = useMqtt();

const prefix = computed(() => props.card.mqtt_prefix || 'site_dashboard/machines');

const devices = computed(() => {
  const result = [];
  const pfx = prefix.value;
  for (const [topic, value] of Object.entries(mqttStore.topicValues)) {
    if (!topic.startsWith(pfx + '/') || !topic.endsWith('/state')) continue;
    const id = topic.slice(pfx.length + 1, -'/state'.length);
    if (!id || id.includes('/')) continue;
    let state = null;
    try { state = JSON.parse(value); } catch { /* raw value */ }
    const onlineRaw = mqttStore.topicValues[`${pfx}/${id}/online`];
    result.push({
      id,
      name: state?.name ?? id,
      ip: state?.ip ?? '',
      online: onlineRaw === 'ON' || onlineRaw === true,
    });
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  const ids = props.card.included_ids;
  return ids?.length ? result.filter(d => ids.includes(d.id)) : result;
});

function wake(id) { publish(`${prefix.value}/${id}/command`, 'wake'); }
function shutdown(id) { publish(`${prefix.value}/${id}/command`, 'shutdown'); }
</script>

<style scoped>
.machine-card {
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
  gap: 0.4rem;
  padding: 0.22rem 0.65rem;
  white-space: nowrap;
  overflow: hidden;
}

.device-row:hover {
  background: var(--bg-card-hover);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot--on  { background: #4caf6e; }
.dot--off { background: #e05454; }

.device-name {
  flex: 1;
  font-size: 0.8rem;
  color: #e8eaf0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-meta {
  font-size: 0.7rem;
  color: #6b7499;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.action-btn {
  font-size: 0.65rem;
  font-family: inherit;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: #e8eaf0;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  line-height: 1.4;
}

.action-btn--wake:not(:disabled):hover  { border-color: #4caf6e; color: #4caf6e; }
.action-btn--off:not(:disabled):hover   { border-color: #e05454; color: #e05454; }
.action-btn:disabled { color: var(--text-secondary); cursor: default; }
</style>
