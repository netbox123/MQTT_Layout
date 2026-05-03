<template>
  <div class="card wiim-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiSpeaker" /></svg>
      {{ card.title || 'WiiM' }}
    </div>
    <div v-if="offline" class="empty-msg">Offline</div>
    <template v-else>
      <div class="vol-row">
        <button class="mute-btn" :class="{ 'mute-btn--muted': muted }" @click="toggleMute" title="Mute">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path :d="muted ? mdiVolumeMute : mdiVolumeHigh" />
          </svg>
        </button>
        <input
          type="range" class="vol-slider"
          min="0" max="100" step="1"
          :value="volume"
          @input="onVolumeInput"
          @change="onVolumeChange"
        />
        <span class="vol-value">{{ volume }}</span>
      </div>
      <div class="input-row">
        <button
          v-for="inp in INPUTS"
          :key="inp.id"
          class="input-btn"
          :class="{ 'input-btn--active': activeInput === inp.id }"
          @click="switchInput(inp)"
        >{{ inp.label }}</button>
      </div>
    </template>
  </div>
</template>

<script>
export const icon = '🔊';
</script>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { mdiSpeaker, mdiVolumeHigh, mdiVolumeMute } from '@mdi/js';

const props = defineProps({
  card: { type: Object, required: true },
});

const INPUTS = [
  { id: 'wifi',      label: 'WiFi',    modes: [1, 2, 10, 11, 31, 32, 33, 34, 35], cmd: 'wifi' },
  { id: 'bluetooth', label: 'BT',      modes: [41],                                cmd: 'bluetooth' },
  { id: 'line-in',   label: 'Line In', modes: [40],                                cmd: 'line-in' },
  { id: 'optical',   label: 'Optical', modes: [43],                                cmd: 'optical' },
  { id: 'coaxial',   label: 'Coaxial', modes: [44, 45],                            cmd: 'co-axial' },
];

const volume  = ref(50);
const muted   = ref(false);
const mode    = ref(0);
const offline = ref(false);
const activeInputOverride = ref(null);

const activeInput = computed(() =>
  activeInputOverride.value ?? INPUTS.find(i => i.modes.includes(mode.value))?.id ?? null
);

async function sendCmd(cmd) {
  await fetch(`/api/wiim/proxy?ip=${encodeURIComponent(props.card.ip)}&cmd=${encodeURIComponent(cmd)}`);
}

async function fetchStatus() {
  try {
    const res = await fetch(`/api/wiim/proxy?ip=${encodeURIComponent(props.card.ip)}&cmd=getPlayerStatus`);
    if (!res.ok) { offline.value = true; return; }
    const data = await res.json();
    offline.value = false;
    volume.value = parseInt(data.vol ?? 50);
    muted.value  = data.mute === '1' || data.mute === 1;
    mode.value   = parseInt(data.mode ?? 0);
    const confirmed = INPUTS.find(i => i.modes.includes(parseInt(data.mode)))?.id;
    if (confirmed === activeInputOverride.value) activeInputOverride.value = null;
  } catch {
    offline.value = true;
  }
}

let volDebounce = null;
function onVolumeInput(e) {
  volume.value = parseInt(e.target.value);
  clearTimeout(volDebounce);
  volDebounce = setTimeout(() => sendCmd(`setPlayerCmd:vol:${volume.value}`), 200);
}
function onVolumeChange(e) {
  volume.value = parseInt(e.target.value);
  clearTimeout(volDebounce);
  sendCmd(`setPlayerCmd:vol:${volume.value}`);
}
function toggleMute() {
  muted.value = !muted.value;
  sendCmd(`setPlayerCmd:mute:${muted.value ? 1 : 0}`);
}
function switchInput(inp) {
  activeInputOverride.value = inp.id;
  sendCmd(`setPlayerCmd:switchmode:${inp.cmd}`);
}

let pollTimer = null;
onMounted(() => { fetchStatus(); pollTimer = setInterval(fetchStatus, 3000); });
onUnmounted(() => clearInterval(pollTimer));
</script>

<style scoped>
.wiim-card {
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

.empty-msg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: #9aa3bc;
}

/* ── Volume ── */
.vol-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.mute-btn {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border-radius: 4px;
  transition: color 0.15s;
}
.mute-btn:hover { color: var(--text-primary); }
.mute-btn--muted { color: #e05454; }

.vol-slider {
  flex: 1;
  height: 4px;
  accent-color: #5090d0;
  cursor: pointer;
}

.vol-value {
  font-size: 0.72rem;
  color: var(--text-secondary);
  width: 2ch;
  text-align: right;
  flex-shrink: 0;
}

/* ── Inputs ── */
.input-row {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 1.2rem;
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
.input-btn:hover { border-color: #5090d0; color: #5090d0; }
.input-btn--active {
  background: #1c2a40;
  border-color: #5090d0;
  color: #5090d0;
}
</style>
