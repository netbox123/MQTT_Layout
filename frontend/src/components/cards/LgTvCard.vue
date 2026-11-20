<template>
  <div class="card lgtv-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiTelevision" /></svg>
      {{ card.title || 'LG TV' }}
      <span class="state-dot" :class="isOn ? 'state-dot--on' : 'state-dot--off'" :title="isOn ? 'On' : 'Sleeping'"></span>
    </div>
    <div class="btn-row">
      <button class="tv-btn" :class="{ 'tv-btn--active': isOn }" :title="appletvId ? 'Wake TV + Apple TV' : 'Wake'" @click="wake">
        <svg viewBox="0 0 24 24" fill="currentColor" class="btn-icon"><path :d="mdiPower" /></svg>Wake
      </button>
      <button class="tv-btn" :class="{ 'tv-btn--active': !isOn }" :disabled="!isOn" title="Sleep" @click="send('sleep')">
        <svg viewBox="0 0 24 24" fill="currentColor" class="btn-icon"><path :d="mdiPowerSleep" /></svg>Sleep
      </button>
      <button class="tv-btn" :class="{ 'tv-btn--active': isOn && currentInput === browserApp }"
        :title="`Open ${dashboardUrl} in the TV browser`" @click="send(`url:${dashboardUrl}`)">
        <svg viewBox="0 0 24 24" fill="currentColor" class="btn-icon"><path :d="mdiViewDashboard" /></svg>{{ card.dashboard_label || 'Dashboard' }}
      </button>
    </div>
    <div class="btn-row">
      <button
        v-for="(inp, i) in inputs"
        :key="i"
        class="tv-btn"
        :class="{ 'tv-btn--active': isOn && currentInput === inp.input_id }"
        :title="isOn ? inp.input_id : `Wake and switch to ${inp.input_id}`"
        @click="send(`input:${inp.input_id}`)"
      >{{ inp.label || `AUX ${i + 1}` }}</button>
    </div>
  </div>
</template>

<script>
export const icon = '📺';
export const label = 'LG TV';

export const DEFAULT_DASHBOARD_URL = 'http://192.168.0.20:3000';
export const BROWSER_APP = 'com.webos.app.browser';

export const DEFAULT_INPUTS = [
  { label: 'AUX 1', input_id: 'HDMI_1' },
  { label: 'AUX 2', input_id: 'HDMI_2' },
  { label: 'AUX 3', input_id: 'HDMI_3' },
];
</script>

<script setup>
import { computed } from 'vue';
import { mdiTelevision, mdiPower, mdiPowerSleep, mdiViewDashboard } from '@mdi/js';
import { useMqttStore } from '../../stores/mqttStore.js';
import { useMqtt } from '../../composables/useMqtt.js';

const props = defineProps({ card: { type: Object, required: true } });

const mqttStore = useMqttStore();
const { publish } = useMqtt();

// The server-side LG bridge (server/lgtvBridge.js) handles Wake-on-LAN and the TV socket.
const tvId = computed(() => props.card.tv_id || 'tv_shed');
const isOn = computed(() => mqttStore.getValue(`lgtv/${tvId.value}/state`) === 'on');
const currentInput = computed(() => mqttStore.getValue(`lgtv/${tvId.value}/input`));

const browserApp = BROWSER_APP;
const dashboardUrl = computed(() => props.card.dashboard_url || DEFAULT_DASHBOARD_URL);

const inputs = computed(() =>
  DEFAULT_INPUTS.map((def, i) => ({ ...def, ...(props.card.inputs?.[i] ?? {}) }))
);

// Optional: Apple TV (server/appletvBridge.py) woken together with the TV.
const appletvId = computed(() => (props.card.appletv_id || '').trim());

function send(cmd) {
  publish(`lgtv/${tvId.value}/cmd`, cmd);
}

function wake() {
  send('wake');
  if (appletvId.value) publish(`appletv/${appletvId.value}/command`, 'turn_on');
  pulseKvm();
}

// Optional: select a KVM switch input on Wake — same short relay pulse as KvmSwitchCard.
function pulseKvm() {
  const kvm = props.card.wake_kvm;
  const topic = kvm?.command_topic?.trim();
  if (!topic) return;
  publish(topic, 'ON');
  setTimeout(() => publish(topic, 'OFF'), kvm.pulse_ms ?? 300);
  if (kvm.state_topic?.trim() && kvm.input) {
    publish(kvm.state_topic.trim(), String(kvm.input), { retain: true });
  }
}
</script>

<style scoped>
.lgtv-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.65rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
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

.state-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-left: auto;
  flex-shrink: 0;
}
.state-dot--on { background: #4caf6e; box-shadow: 0 0 5px #4caf6e; }
.state-dot--off { background: #4a5270; }

.btn-row {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

/* Same look as the WiiM / KVM card buttons */
.tv-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
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
.tv-btn:hover:not(:disabled) { border-color: #5090d0; color: #5090d0; }
.tv-btn:disabled { cursor: default; opacity: 0.6; }
.tv-btn--active {
  background: #1c2a40;
  border-color: #5090d0;
  color: #fff;
}
.btn-icon { width: 11px; height: 11px; }
</style>
