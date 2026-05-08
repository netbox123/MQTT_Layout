<template>
  <div class="card wled-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiLightbulbGroup" /></svg>
      {{ card.title || 'WLED' }}
      <div v-if="cardDevices.length" class="scene-btns">
        <button class="scene-btn" title="Save scene" @click="saveScene">Save</button>
        <button class="scene-btn" title="Recall saved scene" @click="recallScene">Recall</button>
      </div>
    </div>
    <div v-if="!cardDevices.length" class="empty-msg">No devices</div>
    <div v-else class="card-body">
      <div class="sliders">
        <div v-for="ch in channels" :key="ch.key" class="slider-row">
          <button class="sl-btn" @click="setChannel(ch, 0)">{{ ch.label }}</button>
          <input type="range" class="sl-range" :style="{ accentColor: ch.color }"
            min="0" max="255" step="1" :value="ch.val.value"
            @input="onInput(ch, $event)" @change="onChange(ch, $event)" />
          <button class="sl-btn sl-btn--val" @click="setChannel(ch, 255)">{{ ch.val.value }}</button>
        </div>
      </div>
      <div class="preview">
        <div class="color-circle" :style="{ background: previewColor }" title="Apply to all devices" @click="publishAll"></div>
      </div>
    </div>
  </div>
</template>

<script>
export const icon = '💡';
</script>

<script setup>
import { ref, computed, inject } from 'vue';
import { mdiLightbulbGroup } from '@mdi/js';
import { useMqttStore } from '../../stores/mqttStore.js';
import { useMqtt } from '../../composables/useMqtt.js';

const props = defineProps({ card: { type: Object, required: true } });

const mqttStore = useMqttStore();
const { publish } = useMqtt();
const patchCard = inject('patchCard', null);

const saved = props.card.rgbw ?? {};
const r = ref(saved.r ?? 255);
const g = ref(saved.g ?? 255);
const b = ref(saved.b ?? 255);
const w = ref(saved.w ?? 0);

const channels = [
  { key: 'r', label: 'R', val: r, color: '#e05454' },
  { key: 'g', label: 'G', val: g, color: '#4caf6e' },
  { key: 'b', label: 'B', val: b, color: '#5090d0' },
  { key: 'w', label: 'W', val: w, color: '#aaaaaa' },
];

const cardDevices = computed(() => props.card.devices ?? []);

function isOnline(d) {
  return mqttStore.topicValues[`wled/${d.id}/status`] === 'online';
}

const previewColor = computed(() => {
  const pr = Math.min(255, r.value + w.value);
  const pg = Math.min(255, g.value + w.value);
  const pb = Math.min(255, b.value + w.value);
  return `rgb(${pr}, ${pg}, ${pb})`;
});

function publishAll() {
  for (const d of cardDevices.value) {
    if (!isOnline(d)) continue;
    publish(`wled/${d.id}/api`, JSON.stringify({
      on: true, bri: 255,
      seg: [{ col: [[r.value, g.value, b.value, w.value]] }],
    }));
  }
}

const debounces = {};
function onInput(ch, e) {
  ch.val.value = parseInt(e.target.value);
  clearTimeout(debounces[ch.key]);
  debounces[ch.key] = setTimeout(publishAll, 80);
}
function onChange(ch, e) {
  ch.val.value = parseInt(e.target.value);
  clearTimeout(debounces[ch.key]);
  publishAll();
}
function setChannel(ch, val) {
  ch.val.value = val;
  publishAll();
}

async function saveScene() {
  if (patchCard) await patchCard(props.card, { rgbw: { r: r.value, g: g.value, b: b.value, w: w.value } });
}

function recallScene() {
  const s = props.card.rgbw;
  if (!s) return;
  r.value = s.r ?? 255;
  g.value = s.g ?? 255;
  b.value = s.b ?? 255;
  w.value = s.w ?? 0;
  publishAll();
}
</script>

<style scoped>
.wled-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.65rem 0.5rem;
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
  margin-bottom: 0.35rem;
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

.card-body {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 0.5rem;
  flex: 1;
  align-items: center;
}

.sliders {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.sl-btn {
  font-size: 0.68rem;
  font-family: inherit;
  font-weight: 600;
  padding: 0.1rem 0.28rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1.4;
  transition: color 0.12s, border-color 0.12s;
}
.sl-btn:hover { color: #fff; border-color: #5090d0; }
.sl-btn--val { width: 30px; box-sizing: border-box; text-align: center; }

.sl-range {
  flex: 1;
  height: 4px;
  cursor: pointer;
  min-width: 0;
}

.preview {
  display: flex;
  align-items: center;
  justify-content: center;
}

.scene-btns {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
}

.scene-btn {
  font-size: 0.58rem;
  font-family: inherit;
  font-weight: 600;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  line-height: 1.4;
  transition: color 0.12s, border-color 0.12s;
}
.scene-btn:hover { color: var(--text-primary); border-color: #5090d0; }

.color-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.12);
  box-shadow: 0 0 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
  transition: background 0.1s, transform 0.1s, box-shadow 0.1s;
  flex-shrink: 0;
  cursor: pointer;
}
.color-circle:hover {
  transform: scale(1.08);
  box-shadow: 0 0 18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15);
}
.color-circle:active {
  transform: scale(0.95);
}
</style>
