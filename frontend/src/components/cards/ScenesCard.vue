<template>
  <div class="card scenes-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiLayers" /></svg>
      {{ card.title || 'Scenes' }}
      <button v-if="activeSceneId || pausedSceneId" class="clear-queue-btn" @click.stop="clearQueue">clear</button>
    </div>
    <div v-if="!scenes.length" class="empty-msg">No scenes configured</div>
    <div v-else class="scene-list">
      <div v-for="s in sortedScenes" :key="s._key" class="scene-row" @click="applyScene(s)">
        <span class="scene-icon-wrap">
          <span v-if="s._slot === 'active'" class="dot dot--green"></span>
          <span v-else-if="s._slot === 'paused'" class="dot dot--red"></span>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" class="play-icon"><path :d="mdiPlay" /></svg>
        </span>
        <span class="scene-name" @click.stop="openDetail(s)">{{ s.name }}</span>
        <input v-if="s._slot === 'active'"
          type="range" class="progress-range"
          min="0" :max="sceneTime(s)" :value="activeElapsed"
          readonly />
        <input v-else-if="s._slot === 'paused'"
          type="range" class="progress-range progress-range--paused"
          min="0" :max="sceneTime(s)" :value="pausedElapsed"
          readonly />
        <span v-else class="scene-duration">{{ sceneTime(s) }}s</span>
        <button v-if="editing" class="row-edit-btn" @click.stop="openEdit(s)">✎</button>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="dialog" class="dialog-backdrop" @click.self="dialog = null">
      <div class="dialog">
        <h3 class="dialog-title">{{ dialog.isNew ? 'Add Scene' : 'Edit Scene' }}</h3>

        <div class="fields">
          <label class="field-label">Name</label>
          <input class="field-input" v-model="dialog.name" placeholder="Movie Night" />
          <label class="field-label field-label--top">Devices</label>
          <div class="device-list">
            <label v-for="d in allDevices" :key="d.id" class="device-item">
              <input type="checkbox" :checked="dialog.devices.includes(d.id)" @change="toggleDevice(d.id)" />
              <span class="device-name">{{ d.name }}</span>
            </label>
          </div>
          <label class="field-label">Trigger</label>
          <select class="field-input field-select" v-model="dialog.trigger">
            <option value="">— none —</option>
            <option value="mqtt">MQTT</option>
            <option value="time">Time</option>
          </select>
          <template v-if="dialog.trigger === 'mqtt'">
            <label class="field-label">MQTT</label>
            <input class="field-input" v-model="dialog.trigger_mqtt_topic" placeholder="home/sensor/temp" />
            <label class="field-label">Condition</label>
            <select class="field-input field-select" v-model="dialog.trigger_condition">
              <option value=">">&gt; (greater than)</option>
              <option value="<">&lt; (less than)</option>
              <option value="=">= (equals)</option>
            </select>
            <label class="field-label">Value</label>
            <input class="field-input"
              :type="dialog.trigger_condition === '=' ? 'text' : 'number'"
              v-model="dialog.trigger_value"
              :placeholder="dialog.trigger_condition === '=' ? 'e.g. ON' : 'e.g. 25'" />
          </template>
          <template v-if="dialog.trigger === 'time'">
            <label class="field-label">Time</label>
            <input class="field-input field-input--short" v-model="dialog.trigger_time" type="time" />
            <label class="field-label">Days</label>
            <div class="days-row">
              <label v-for="(day, i) in ['M','T','W','T','F','S','S']" :key="i" class="day-item">
                <input type="checkbox" :checked="dialog.trigger_days.includes(i)" @change="toggleDay(i)" />
                <span>{{ day }}</span>
              </label>
            </div>
          </template>
        </div>

        <div v-if="dialog.error" class="dialog-error">{{ dialog.error }}</div>
        <div class="dialog-actions">
          <button v-if="!dialog.isNew" class="dialog-delete" @click="deleteScene">Delete</button>
          <span v-else></span>
          <div class="dialog-actions-right">
            <button class="dialog-cancel" @click="dialog = null">Cancel</button>
            <button class="dialog-confirm" :disabled="!dialog.name.trim()" @click="saveScene">OK</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Scene detail dialog -->
  <Teleport to="body">
    <div v-if="detailScene" class="dialog-backdrop detail-backdrop" @click.self="detailScene = null">
      <div class="dialog detail-dialog">
        <div class="detail-header">
          <h3 class="dialog-title">Edit {{ detailScene.name }}</h3>
          <span class="detail-total">{{ detailTotalTime }}s total</span>
        </div>

        <div class="detail-body">
          <div class="detail-btns">
            <button class="detail-btn" @click="openSetDimmer">Set dimmer</button>
            <button class="detail-btn" @click="openSetFade">Fade</button>
            <button class="detail-btn" @click="openSetHaLight">Set HA light</button>
            <button class="detail-btn" @click="openSetRandom">Random</button>
          </div>
          <div class="items-list">
            <div v-if="!detailScene.items.length" class="no-items">No lights configured yet</div>
            <div v-for="(item, i) in detailScene.items" :key="i" class="item-row"
              draggable="true"
              :class="{ 'item-row--drag-over': dropIndex === i && dragIndex !== i }"
              @dragstart="onDragStart(i)"
              @dragover.prevent="onDragOver(i)"
              @dragend="onDragEnd"
              @drop.prevent="onDrop(i)">
              <span class="drag-handle">⠿</span>
              <div class="item-swatch" :style="{ background: itemColor(item) }"></div>
              <span class="item-name">{{ item.name }}<span v-if="item.type === 'ha_light' && item.lights?.length" class="item-count"> ({{ item.lights.length }})</span></span>
              <span class="item-duration">{{ item.duration }}s</span>
              <button class="item-edit" @click="editItem(item, i)">✎</button>
              <button class="item-remove" @click="detailScene.items.splice(i, 1)">✕</button>
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <span></span>
          <div class="dialog-actions-right">
            <button class="dialog-cancel" @click="detailScene = null">Cancel</button>
            <button class="dialog-confirm" @click="saveDetail">Save</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Set dimmer sub-dialog -->
  <Teleport to="body">
    <div v-if="dimmerForm" class="dialog-backdrop dimmer-backdrop" @click.self="dimmerForm = null">
      <div class="dialog">
        <h3 class="dialog-title">Set Dimmer</h3>

        <div class="preview">
          <div class="color-circle" :style="{ background: dimmerPreviewColor }"></div>
        </div>

        <div class="sliders">
          <div v-for="ch in dialogChannels" :key="ch.key" class="slider-row">
            <button class="sl-btn" :style="{ color: ch.color }" @click="dimmerForm[ch.key] = 0; previewDimmer()">{{ ch.label }}</button>
            <input type="range" class="sl-range" :style="{ accentColor: ch.color }"
              min="0" max="255" step="1" :value="dimmerForm[ch.key]"
              @input="dimmerForm[ch.key] = parseInt($event.target.value); previewDimmer()" />
            <button class="sl-btn sl-btn--val" @click="dimmerForm[ch.key] = 255; previewDimmer()">{{ dimmerForm[ch.key] }}</button>
          </div>
          <div class="duration-divider"></div>
          <div class="slider-row duration-row">
            <label class="field-label">Duration (s)</label>
            <input class="field-input field-input--short" type="number" min="0" step="1" v-model.number="dimmerForm.duration" />
          </div>
        </div>

        <div class="dialog-actions">
          <span></span>
          <div class="dialog-actions-right">
            <button class="dialog-cancel" @click="dimmerForm = null">Cancel</button>
            <button class="dialog-confirm" @click="confirmSetDimmer">OK</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Fade sub-dialog -->
  <Teleport to="body">
    <div v-if="fadeForm" class="dialog-backdrop fade-backdrop" @click.self="fadeForm = null">
      <div class="dialog fade-dialog">
        <h3 class="dialog-title">Fade</h3>

        <div class="preview">
          <div class="color-circle" :style="{ background: fadeEndColor }"></div>
        </div>

        <div class="sliders">
          <div v-for="ch in dialogChannels" :key="'e'+ch.key" class="slider-row">
            <button class="sl-btn" :style="{ color: ch.color }" @click="fadeForm.e[ch.key] = 0; previewFade()">{{ ch.label }}</button>
            <input type="range" class="sl-range" :style="{ accentColor: ch.color }"
              min="0" max="255" step="1" :value="fadeForm.e[ch.key]"
              @input="fadeForm.e[ch.key] = parseInt($event.target.value); previewFade()" />
            <button class="sl-btn sl-btn--val" @click="fadeForm.e[ch.key] = 255; previewFade()">{{ fadeForm.e[ch.key] }}</button>
          </div>
        </div>

        <div class="duration-divider"></div>
        <div class="fields fade-duration">
          <label class="field-label">Duration (s)</label>
          <input class="field-input field-input--short" type="number" min="0" step="1" v-model.number="fadeForm.duration" />
        </div>

        <div class="dialog-actions">
          <span></span>
          <div class="dialog-actions-right">
            <button class="dialog-cancel" @click="fadeForm = null">Cancel</button>
            <button class="dialog-confirm" @click="confirmSetFade">OK</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Set HA light sub-dialog -->
  <Teleport to="body">
    <div v-if="haLightForm" class="dialog-backdrop ha-backdrop" @click.self="haLightForm = null">
      <div class="dialog ha-dialog">
        <h3 class="dialog-title">Set HA Light</h3>

        <div class="fields">
          <label class="field-label">Duration (s)</label>
          <input class="field-input field-input--short" type="number" min="0" step="1" v-model.number="haLightForm.duration" />
        </div>

        <div class="ha-list">
          <div v-if="!haEntities.length" class="no-items">No HA switches found in pages</div>
          <div v-for="e in haLightForm.entities" :key="e.command_topic" class="ha-row">
            <input type="checkbox" v-model="e.selected" />
            <span class="ha-name">{{ e.name }}</span>
            <span class="ha-page">{{ e.page }}</span>
            <div class="ha-toggle">
              <button :class="['ha-btn', e.state === 'ON' ? 'ha-btn--on' : '']" @click="e.state = 'ON'">ON</button>
              <button :class="['ha-btn', e.state === 'OFF' ? 'ha-btn--off' : '']" @click="e.state = 'OFF'">OFF</button>
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <span></span>
          <div class="dialog-actions-right">
            <button class="dialog-cancel" @click="haLightForm = null">Cancel</button>
            <button class="dialog-confirm" @click="confirmSetHaLight">OK</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Random sub-dialog -->
  <Teleport to="body">
    <div v-if="randomForm" class="dialog-backdrop random-backdrop" @click.self="randomForm = null">
      <div class="dialog">
        <h3 class="dialog-title">Random</h3>

        <div class="preview">
          <div class="color-circle" :style="{ background: randomPreviewColor }"></div>
        </div>

        <div class="sliders">
          <div v-for="ch in dialogChannels" :key="ch.key" class="slider-row">
            <input type="checkbox" class="ch-check"
              :checked="randomForm[ch.key + '_enabled']"
              @change="randomForm[ch.key + '_enabled'] = $event.target.checked" />
            <button class="sl-btn" :style="{ color: ch.color }" @click="randomForm[ch.key] = 0; previewRandom()">{{ ch.label }}</button>
            <input type="range" class="sl-range" :style="{ accentColor: ch.color, opacity: randomForm[ch.key + '_enabled'] ? 1 : 0.3 }"
              min="0" max="255" step="1" :value="randomForm[ch.key]"
              @input="randomForm[ch.key] = parseInt($event.target.value); previewRandom()" />
            <button class="sl-btn sl-btn--val" @click="randomForm[ch.key] = 255; previewRandom()">{{ randomForm[ch.key] }}</button>
          </div>
          <div class="duration-divider"></div>
          <div class="random-fields-grid">
            <label class="field-label">Duration (s)</label>
            <input class="field-input field-input--short" type="number" min="1" step="1" v-model.number="randomForm.duration" />
            <label class="field-label">Speed (s)</label>
            <input class="field-input field-input--short" type="number" min="0.5" step="0.5" v-model.number="randomForm.speed" />
            <label class="field-label">Random (±)</label>
            <input class="field-input field-input--short" type="number" min="1" max="255" step="1" v-model.number="randomForm.randomAmt" />
          </div>
        </div>

        <div class="dialog-actions">
          <span></span>
          <div class="dialog-actions-right">
            <button class="dialog-cancel" @click="randomForm = null">Cancel</button>
            <button class="dialog-confirm" @click="confirmSetRandom">OK</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
export const icon = '🎬';
</script>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted } from 'vue';
import { mdiLayers, mdiPlay } from '@mdi/js';
import { useMqttStore } from '../../stores/mqttStore.js';
import { useMqtt } from '../../composables/useMqtt.js';

const props = defineProps({ card: { type: Object, required: true } });

const editing = inject('editing', ref(false));
const patchCard = inject('patchCard', null);
const mqttStore = useMqttStore();
const { publish } = useMqtt();

const scenes = ref([]);
const allDevices = ref([]);
const haEntities = ref([]);

const lastColor = {};  // { [deviceId]: { r, g, b, w } } — tracks last sent color per device

const activeSceneId = ref(null);
const activeElapsed = ref(0);  // seconds, live
const pausedSceneId = ref(null);
const pausedElapsed = ref(0);  // seconds, frozen

let activeTimer = null;
let activeInterval = null;
let activeItemTimers = [];
let activeServerStartTime = 0;  // tracks server-reported start time of active scene

function clearItemTimers() {
  for (const t of activeItemTimers) clearTimeout(t);
  activeItemTimers = [];
}

const sortedScenes = computed(() => {
  const sorted = [...scenes.value].sort((a, b) => a.name.localeCompare(b.name));
  const activeId = activeSceneId.value;
  const pausedId = pausedSceneId.value;
  const allowedIds = props.card.scene_ids; // undefined = show all; [] = none; [...ids] = these only
  const rest = sorted.filter(s => {
    if (s.id === activeId || s.id === pausedId) return false;
    if (allowedIds === undefined) return true;
    return allowedIds.includes(s.id);
  });
  const active = activeId ? sorted.find(s => s.id === activeId) : null;
  const paused = pausedId ? sorted.find(s => s.id === pausedId) : null;
  return [
    ...(active ? [{ ...active, _key: `a-${active.id}`, _slot: 'active' }] : []),
    ...(paused ? [{ ...paused, _key: `p-${paused.id}`, _slot: 'paused' }] : []),
    ...rest.map(s => ({ ...s, _key: String(s.id), _slot: 'idle' })),
  ];
});

async function fetchScenes() {
  try {
    const res = await fetch('/api/scenes');
    if (res.ok) scenes.value = await res.json();
  } catch { /* ignore */ }
}

async function fetchDevices() {
  try {
    const res = await fetch('/api/wled-devices');
    if (res.ok) allDevices.value = await res.json();
  } catch { /* ignore */ }
}

async function fetchHaEntities() {
  try {
    const res = await fetch('/api/ha-entities');
    if (res.ok) haEntities.value = await res.json();
  } catch { /* ignore */ }
}

// Sync UI from server-pushed scene state
function syncSceneState(detail) {
  const { activeSceneId: sid, activeStartTime, activeTotalDuration, pausedSceneId: pid, pausedElapsed: pe } = detail;
  clearTimeout(activeTimer);
  clearInterval(activeInterval);
  clearItemTimers();
  pausedSceneId.value = pid ?? null;
  pausedElapsed.value = pe ?? 0;
  if (sid) {
    activeSceneId.value = sid;
    if (activeStartTime) activeServerStartTime = activeStartTime;
    if (activeTotalDuration > 0) {
      const elapsed = Math.min((Date.now() - activeStartTime) / 1000, activeTotalDuration);
      activeElapsed.value = elapsed;
      activeInterval = setInterval(() => {
        activeElapsed.value = Math.min((Date.now() - activeStartTime) / 1000, activeTotalDuration);
      }, 50);
      const remaining = (activeTotalDuration - elapsed) * 1000;
      activeTimer = setTimeout(() => {
        clearInterval(activeInterval);
        activeInterval = null;
        activeSceneId.value = null;
        activeElapsed.value = 0;
        activeServerStartTime = 0;
        pausedSceneId.value = null;
        pausedElapsed.value = 0;
      }, Math.max(0, remaining));
    }
  } else {
    activeSceneId.value = null;
    activeElapsed.value = 0;
    activeServerStartTime = 0;
  }
}

function onSceneTrigger(e) {
  if (!e.detail.auto) return;  // scene-state handles the UI for auto triggers
}

function onSceneState(e) {
  syncSceneState(e.detail);
}

async function fetchSceneState() {
  try {
    const res = await fetch('/api/scenes/state');
    if (res.ok) syncSceneState(await res.json());
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchScenes();
  fetchDevices();
  fetchHaEntities();
  fetchSceneState();
  window.addEventListener('scenes-updated', fetchScenes);
  window.addEventListener('wled-devices-updated', fetchDevices);
  window.addEventListener('scene-trigger', onSceneTrigger);
  window.addEventListener('scene-state', onSceneState);
});
onUnmounted(() => {
  window.removeEventListener('scenes-updated', fetchScenes);
  window.removeEventListener('wled-devices-updated', fetchDevices);
  window.removeEventListener('scene-trigger', onSceneTrigger);
  window.removeEventListener('scene-state', onSceneState);
  clearTimeout(activeTimer);
  clearInterval(activeInterval);
  clearItemTimers();
});

function isOnline(deviceId) {
  return mqttStore.topicValues[`wled/${deviceId}/status`] === 'online';
}

function publishScene(s, transitionSec) {
  const transition = Math.round(transitionSec * 10);
  if (s.items?.length) {
    for (const item of s.items) {
      if (item.type === 'dimmer') {
        const itemTransition = Math.round((item.duration ?? transitionSec) * 10);
        for (const id of (s.devices ?? [])) {
          if (!isOnline(id)) continue;
          publish(`wled/${id}/api`, JSON.stringify({
            on: true, bri: 255, transition: itemTransition,
            seg: [{ col: [[item.r ?? 255, item.g ?? 255, item.b ?? 255, item.w ?? 0]] }],
          }));
        }
      }
    }
  } else {
    for (const id of (s.devices ?? [])) {
      if (!isOnline(id)) continue;
      publish(`wled/${id}/api`, JSON.stringify({
        on: true, bri: 255, transition,
        seg: [{ col: [[s.r ?? 255, s.g ?? 255, s.b ?? 255, s.w ?? 0]] }],
      }));
    }
  }
}

function startActive(s, fromElapsed) {
  const totalDuration = sceneTime(s);
  clearTimeout(activeTimer);
  clearInterval(activeInterval);

  activeSceneId.value = s.id;
  activeElapsed.value = fromElapsed;
  const remaining = totalDuration - fromElapsed;
  const startTime = Date.now() - fromElapsed * 1000;

  activeInterval = setInterval(() => {
    activeElapsed.value = Math.min((Date.now() - startTime) / 1000, totalDuration);
  }, 50);

  activeTimer = setTimeout(() => {
    clearInterval(activeInterval);
    activeInterval = null;
    activeSceneId.value = null;
    activeElapsed.value = 0;
    // Server auto-resumes the paused scene and broadcasts scene-trigger — just clear UI
    pausedSceneId.value = null;
    pausedElapsed.value = 0;
  }, remaining * 1000);
}

function scheduleItems(s) {
  clearItemTimers();
  let offset = 0;
  for (const item of (s.items ?? [])) {
    const delay = offset * 1000;
    const devices = s.devices ?? [];
    if (item.type === 'dimmer') {
      const { r, g, b, w } = { r: item.r ?? 255, g: item.g ?? 255, b: item.b ?? 255, w: item.w ?? 0 };
      const payload = JSON.stringify({ on: true, bri: 255, transition: 0, seg: [{ col: [[r, g, b, w]] }] });
      activeItemTimers.push(setTimeout(() => {
        for (const id of devices) {
          if (!isOnline(id)) continue;
          publish(`wled/${id}/api`, payload);
          lastColor[id] = { r, g, b, w };
        }
      }, delay));
    } else if (item.type === 'fade') {
      const r2 = item.r2 ?? 0, g2 = item.g2 ?? 0, b2 = item.b2 ?? 0, w2 = item.w2 ?? 0;
      const totalSec = item.duration ?? 1;
      const steps = Math.max(1, Math.round(totalSec));
      activeItemTimers.push(setTimeout(() => {
        // Capture start colors at the moment the fade begins
        const startColors = {};
        for (const id of devices) startColors[id] = { ...(lastColor[id] ?? { r: 0, g: 0, b: 0, w: 0 }) };

        for (let step = 0; step <= steps; step++) {
          const t = step / steps;
          activeItemTimers.push(setTimeout(() => {
            for (const id of devices) {
              if (!isOnline(id)) continue;
              const s = startColors[id];
              const r = Math.round(s.r + (r2 - s.r) * t);
              const g = Math.round(s.g + (g2 - s.g) * t);
              const b = Math.round(s.b + (b2 - s.b) * t);
              const w = Math.round(s.w + (w2 - s.w) * t);
              publish(`wled/${id}/api`, JSON.stringify({ on: true, bri: 255, transition: 9, seg: [{ col: [[r, g, b, w]] }] }));
              if (step === steps) lastColor[id] = { r: r2, g: g2, b: b2, w: w2 };
            }
          }, step * 1000));
        }
      }, delay));
    } else if (item.type === 'ha_light') {
      activeItemTimers.push(setTimeout(() => {
        for (const l of (item.lights ?? [])) triggerLight(l);
      }, delay));
    }
    offset += item.duration ?? 0;
  }
}

async function clearQueue() {
  try {
    await fetch('/api/scenes/stop', { method: 'POST' });
  } catch { /* ignore */ }
}

async function applyScene(s) {
  // Compute the accurate elapsed time of the currently-playing scene before we replace it
  const currentElapsed = activeSceneId.value && activeServerStartTime
    ? Math.max(0, (Date.now() - activeServerStartTime) / 1000)
    : 0;
  // Optimistic UI update — server-pushed scene-state will confirm/sync shortly
  syncSceneState({
    activeSceneId: s.id,
    activeStartTime: Date.now(),
    activeTotalDuration: sceneTime(s),
    pausedSceneId: activeSceneId.value ? activeSceneId.value : null,
    pausedElapsed: activeSceneId.value ? currentElapsed : 0,
  });
  // Server handles actual WLED/HA execution
  try {
    await fetch(`/api/scenes/${s.id}/execute`, { method: 'POST' });
  } catch { /* ignore */ }
}

// ── Dialog ────────────────────────────────────────────────────────────────────
const dialog = ref(null);

const dialogChannels = [
  { key: 'r', label: 'R', color: '#e05454' },
  { key: 'g', label: 'G', color: '#4caf6e' },
  { key: 'b', label: 'B', color: '#5090d0' },
  { key: 'w', label: 'W', color: '#aaaaaa' },
];

function openAdd() {
  dialog.value = { name: '', devices: [], trigger: '', trigger_mqtt_topic: '', trigger_condition: '=', trigger_value: '', trigger_time: '', trigger_days: [0,1,2,3,4,5,6], isNew: true, error: '' };
}

function openEdit(s) {
  dialog.value = { ...s, devices: [...(s.devices ?? [])], trigger: s.trigger ?? '', trigger_mqtt_topic: s.trigger_mqtt_topic ?? '', trigger_condition: s.trigger_condition ?? '=', trigger_value: s.trigger_value ?? '', trigger_time: s.trigger_time ?? '', trigger_days: s.trigger_days ?? [0,1,2,3,4,5,6], isNew: false, error: '' };
}

function toggleDay(i) {
  const idx = dialog.value.trigger_days.indexOf(i);
  if (idx >= 0) dialog.value.trigger_days.splice(idx, 1);
  else dialog.value.trigger_days.push(i);
}

function toggleDevice(id) {
  const idx = dialog.value.devices.indexOf(id);
  if (idx >= 0) dialog.value.devices.splice(idx, 1);
  else dialog.value.devices.push(id);
}

async function saveScene() {
  if (!dialog.value.name.trim()) return;
  const { isNew, error, ...data } = dialog.value;
  let updated;
  if (isNew) {
    const newId = Date.now();
    updated = [...scenes.value, { ...data, id: newId }];
    // If this card has an explicit scene_ids list, add the new scene to it
    if (patchCard && props.card.scene_ids !== undefined) {
      await patchCard(props.card, { scene_ids: [...props.card.scene_ids, newId] });
    }
  } else {
    updated = scenes.value.map(s => s.id === data.id ? data : s);
  }
  await patch(updated);
  dialog.value = null;
}

async function deleteScene() {
  await patch(scenes.value.filter(s => s.id !== dialog.value.id));
  dialog.value = null;
}

async function patch(list) {
  await fetch('/api/scenes', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(list),
  });
  window.dispatchEvent(new CustomEvent('scenes-updated'));
  await fetchScenes();
}

// ── Set HA light sub-dialog ───────────────────────────────────────────────────
const haLightForm = ref(null);

function openSetHaLight(item = null, index = null) {
  const existing = item?.lights ?? [];
  haLightForm.value = {
    duration: item?.duration ?? 1,
    editIndex: index,
    entities: haEntities.value.map(e => {
      const match = existing.find(l => l.ha_entity_id === e.ha_entity_id);
      return { ...e, selected: !!match, state: match?.state ?? 'ON' };
    }),
  };
}

function callHaService(ha_entity_id, state) {
  if (!ha_entity_id) return;
  const domain = ha_entity_id.split('.')[0];
  const service = state === 'ON' ? 'turn_on' : 'turn_off';
  fetch(`/api/ha/service/${domain}/${service}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_id: ha_entity_id }),
  }).catch(() => {});
}

function triggerLight(l) {
  if (l.ha_entity_id) callHaService(l.ha_entity_id, l.state);
}

function confirmSetHaLight() {
  const { duration, entities, editIndex } = haLightForm.value;
  const selected = entities.filter(e => e.selected);
  if (!selected.length) { haLightForm.value = null; return; }
  const entry = {
    type: 'ha_light',
    name: 'Set HA light',
    duration,
    lights: selected.map(e => ({ name: e.name, page: e.page, ha_entity_id: e.ha_entity_id, command_topic: e.command_topic, state: e.state })),
  };
  if (editIndex !== null) detailScene.value.items.splice(editIndex, 1, entry);
  else detailScene.value.items.push(entry);
  for (const e of selected) triggerLight({ ha_entity_id: e.ha_entity_id, command_topic: e.command_topic, state: e.state });
  haLightForm.value = null;
}

// ── Scene detail dialog ───────────────────────────────────────────────────────
const detailScene = ref(null);
const dragIndex = ref(null);
const dropIndex = ref(null);

function onDragStart(i) { dragIndex.value = i; }
function onDragOver(i) { dropIndex.value = i; }
function onDragEnd() { dragIndex.value = null; dropIndex.value = null; }
function onDrop(i) {
  if (dragIndex.value === null || dragIndex.value === i) { onDragEnd(); return; }
  const items = detailScene.value.items;
  const [moved] = items.splice(dragIndex.value, 1);
  items.splice(i, 0, moved);
  onDragEnd();
}

function sceneTime(s) {
  const items = s.items ?? [];
  return items.length
    ? items.reduce((sum, item) => sum + (item.duration ?? 0), 0)
    : (s.duration ?? 0);
}

function openDetail(s) {
  detailScene.value = { ...s, items: [...(s.items ?? [])] };
}

const detailTotalTime = computed(() =>
  (detailScene.value?.items ?? []).reduce((sum, item) => sum + (item.duration ?? 0), 0)
);

function itemColor(item) {
  if (item.type === 'ha_light') return '#f0c040';
  if (item.type === 'random') {
    const r = Math.min(255, (item.r ?? 0) + (item.w ?? 0));
    const g = Math.min(255, (item.g ?? 0) + (item.w ?? 0));
    const b = Math.min(255, (item.b ?? 0) + (item.w ?? 0));
    return `rgb(${r}, ${g}, ${b})`;
  }
  if (item.type === 'fade') {
    const r = Math.min(255, (item.r2 ?? 0) + (item.w2 ?? 0));
    const g = Math.min(255, (item.g2 ?? 0) + (item.w2 ?? 0));
    const b = Math.min(255, (item.b2 ?? 0) + (item.w2 ?? 0));
    return `rgb(${r}, ${g}, ${b})`;
  }
  const r = Math.min(255, (item.r ?? 0) + (item.w ?? 0));
  const g = Math.min(255, (item.g ?? 0) + (item.w ?? 0));
  const b = Math.min(255, (item.b ?? 0) + (item.w ?? 0));
  return `rgb(${r}, ${g}, ${b})`;
}

async function saveDetail() {
  const updated = scenes.value.map(s =>
    s.id === detailScene.value.id ? { ...s, items: detailScene.value.items } : s
  );
  await patch(updated);
  detailScene.value = null;
}

// ── Set dimmer sub-dialog ─────────────────────────────────────────────────────
const dimmerForm = ref(null);

const dimmerPreviewColor = computed(() => {
  if (!dimmerForm.value) return '#fff';
  const { r, g, b, w } = dimmerForm.value;
  return `rgb(${Math.min(255, r + w)}, ${Math.min(255, g + w)}, ${Math.min(255, b + w)})`;
});

const sceneDevices = computed(() => {
  const ids = (detailScene.value?.devices ?? []).map(d => d.id);
  return allDevices.value.filter(d => ids.includes(d.id));
});

function editItem(item, index) {
  if (item.type === 'dimmer') openSetDimmer(item, index);
  else if (item.type === 'fade') openSetFade(item, index);
  else if (item.type === 'ha_light') openSetHaLight(item, index);
  else if (item.type === 'random') openSetRandom(item, index);
}

// ── Fade sub-dialog ───────────────────────────────────────────────────────────
const fadeForm = ref(null);

const fadeEndColor = computed(() => {
  if (!fadeForm.value) return '#fff';
  const { r, g, b, w } = fadeForm.value.e;
  return `rgb(${Math.min(255, r + w)}, ${Math.min(255, g + w)}, ${Math.min(255, b + w)})`;
});

function openSetFade(item = null, index = null) {
  fadeForm.value = {
    e: { r: item?.r2 ?? 0, g: item?.g2 ?? 0, b: item?.b2 ?? 0, w: item?.w2 ?? 0 },
    duration: item?.duration ?? 10,
    editIndex: index,
  };
}

function confirmSetFade() {
  const { e, duration, editIndex } = fadeForm.value;
  const entry = {
    type: 'fade',
    name: `Fade → (${e.r},${e.g},${e.b},${e.w})`,
    r2: e.r, g2: e.g, b2: e.b, w2: e.w,
    duration,
    useCurrentAsStart: true,
  };
  if (editIndex !== null) detailScene.value.items.splice(editIndex, 1, entry);
  else detailScene.value.items.push(entry);
  fadeForm.value = null;
}

function previewDimmer() {
  if (!dimmerForm.value) return;
  const { r, g, b, w } = dimmerForm.value;
  for (const id of (detailScene.value?.devices ?? [])) {
    if (!isOnline(id)) continue;
    publish(`wled/${id}/api`, JSON.stringify({
      on: true, bri: 255, transition: 0,
      seg: [{ col: [[r, g, b, w]] }],
    }));
  }
}

function previewFade() {
  if (!fadeForm.value) return;
  const { r, g, b, w } = fadeForm.value.e;
  for (const id of (detailScene.value?.devices ?? [])) {
    if (!isOnline(id)) continue;
    publish(`wled/${id}/api`, JSON.stringify({
      on: true, bri: 255, transition: 0,
      seg: [{ col: [[r, g, b, w]] }],
    }));
  }
}

function previewRandom() {
  if (!randomForm.value) return;
  const { r, g, b, w } = randomForm.value;
  for (const id of (detailScene.value?.devices ?? [])) {
    if (!isOnline(id)) continue;
    publish(`wled/${id}/api`, JSON.stringify({
      on: true, bri: 255, transition: 0,
      seg: [{ col: [[r, g, b, w]] }],
    }));
  }
}

function openSetDimmer(item = null, index = null) {
  dimmerForm.value = {
    r: item?.r ?? 255, g: item?.g ?? 255, b: item?.b ?? 255, w: item?.w ?? 0,
    duration: item?.duration ?? 1,
    editIndex: index,
  };
}

function confirmSetDimmer() {
  const { r, g, b, w, duration, editIndex } = dimmerForm.value;
  const entry = { type: 'dimmer', name: `Set to (${r}, ${g}, ${b}, ${w})`, r, g, b, w, duration };
  if (editIndex !== null) detailScene.value.items.splice(editIndex, 1, entry);
  else detailScene.value.items.push(entry);
  const transition = Math.round((duration ?? 0) * 10);
  for (const id of (detailScene.value.devices ?? [])) {
    if (!isOnline(id)) continue;
    publish(`wled/${id}/api`, JSON.stringify({
      on: true, bri: 255, transition,
      seg: [{ col: [[r, g, b, w]] }],
    }));
  }
  dimmerForm.value = null;
}

// ── Random sub-dialog ─────────────────────────────────────────────────────────
const randomForm = ref(null);

const randomPreviewColor = computed(() => {
  if (!randomForm.value) return '#fff';
  const { r, g, b, w } = randomForm.value;
  return `rgb(${Math.min(255, r + w)}, ${Math.min(255, g + w)}, ${Math.min(255, b + w)})`;
});

function openSetRandom(item = null, index = null) {
  randomForm.value = {
    r: item?.r ?? 128,
    g: item?.g ?? 0,
    b: item?.b ?? 128,
    w: item?.w ?? 0,
    r_enabled: item?.r_enabled ?? true,
    g_enabled: item?.g_enabled ?? true,
    b_enabled: item?.b_enabled ?? false,
    w_enabled: item?.w_enabled ?? false,
    duration: item?.duration ?? 60,
    speed: item?.speed ?? 4,
    randomAmt: item?.random ?? 20,
    editIndex: index,
  };
}

function confirmSetRandom() {
  const { r, g, b, w, r_enabled, g_enabled, b_enabled, w_enabled, duration, speed, randomAmt, editIndex } = randomForm.value;
  const channels = [r_enabled && 'R', g_enabled && 'G', b_enabled && 'B', w_enabled && 'W'].filter(Boolean).join('');
  const entry = {
    type: 'random',
    name: `Random ${channels || 'fixed'} ±${randomAmt}`,
    r, g, b, w, r_enabled, g_enabled, b_enabled, w_enabled,
    duration, speed, random: randomAmt,
  };
  if (editIndex !== null) detailScene.value.items.splice(editIndex, 1, entry);
  else detailScene.value.items.push(entry);
  randomForm.value = null;
}

defineExpose({ openAdd });
</script>

<style scoped>
.scenes-card {
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

.header-icon { width: 13px; height: 13px; flex-shrink: 0; }

.clear-queue-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.7rem;
  cursor: pointer;
  padding: 0.1rem 0.25rem;
  border-radius: 3px;
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.15s;
}
.clear-queue-btn:hover { color: var(--accent-red); }

.empty-msg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: #9aa3bc;
}

.scene-list {
  flex: 1;
  overflow-y: auto;
  margin: 0 -0.65rem;
}

.scene-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.22rem 0.65rem;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
}
.scene-row:hover { background: var(--bg-card-hover); }

.scene-icon-wrap {
  width: 13px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.play-icon {
  width: 13px;
  height: 13px;
  color: var(--accent-blue);
  opacity: 0.6;
}
.scene-row:hover .play-icon { opacity: 1; }

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--green { background: #4caf6e; box-shadow: 0 0 6px #4caf6e; }
.dot--red   { background: #e05454; box-shadow: 0 0 6px #e05454; }

.progress-range {
  flex: 1;
  height: 4px;
  cursor: default;
  pointer-events: none;
  accent-color: #4caf6e;
  min-width: 0;
}
.progress-range--paused {
  accent-color: #555;
  opacity: 0.4;
}

.scene-name {
  flex: 1;
  font-size: 0.8rem;
  color: #e8eaf0;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.scene-name:hover { text-decoration: underline; color: #fff; }

.scene-duration {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-family: monospace;
  flex-shrink: 0;
}

.row-edit-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.1rem 0.25rem;
  border-radius: 4px;
  flex-shrink: 0;
  transition: color 0.15s;
}
.row-edit-btn:hover { color: var(--accent-blue); }

/* Dialog */
.dialog-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  overflow-y: auto;
  padding: 2rem 0;
}
.dialog {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.5rem;
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.dialog-title { font-size: 1rem; font-weight: 600; color: var(--text-primary); }

.fields {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
  align-items: center;
}
.field-label--top {
  align-self: start;
  padding-top: 0.35rem;
}
.field-label { font-size: 0.8rem; color: #9aa3bc; white-space: nowrap; }
.field-input {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.875rem;
  padding: 0.35rem 0.6rem;
  font-family: inherit;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.field-input:focus { border-color: var(--accent-blue); }
.field-input--short { width: 8ch; }
.field-select { cursor: pointer; }

.days-row {
  display: flex;
  gap: 0.35rem;
}
.day-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #c0c8e0;
  cursor: pointer;
}

.section-title {
  font-size: 0.75rem;
  color: #9aa3bc;
  margin-bottom: 0.4rem;
  font-weight: 500;
}

.device-list {
  display: flex;
  flex-direction: column;
  height: calc(4 * 1.75rem);
  overflow-y: auto;
  border: 1px solid #3d4870;
  border-radius: 5px;
  padding: 0.25rem 0.5rem;
  background: #2a3150;
  box-sizing: border-box;
}
.device-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.2rem 0;
  flex-shrink: 0;
}
.device-name { font-size: 0.875rem; color: var(--text-primary); }

.rgbw-section { display: flex; flex-direction: column; }

.sliders {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.ch-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
  width: 10px;
  flex-shrink: 0;
}

.sl-range {
  flex: 1;
  height: 4px;
  cursor: pointer;
  min-width: 0;
}

.ch-val {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-family: monospace;
  width: 24px;
  text-align: right;
  flex-shrink: 0;
}

.preview {
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.color-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.12);
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
  flex-shrink: 0;
}

.detail-backdrop { z-index: 1010; }
.dimmer-backdrop { z-index: 1020; }

.detail-dialog { width: 420px; }

.detail-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}

.detail-total {
  font-size: 0.75rem;
  color: #c0c8e0;
  font-family: monospace;
  white-space: nowrap;
  flex-shrink: 0;
}

.detail-body {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  align-items: start;
}

.detail-btns {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.detail-btn {
  font-size: 0.8rem;
  font-family: inherit;
  font-weight: 500;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: #2a3150;
  color: var(--text-primary);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s, border-color 0.12s;
}
.detail-btn:hover { background: #313858; border-color: var(--accent-blue); }
.detail-btn--disabled { opacity: 0.35; cursor: not-allowed; }
.detail-btn--disabled:hover { background: #2a3150; border-color: var(--border); }

.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  height: calc(4 * 1.6rem + 3 * 0.35rem + 1rem);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.5rem 0.6rem;
}

.no-items {
  font-size: 0.8rem;
  color: var(--text-muted);
  padding: 0.25rem 0;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 4px;
}
.item-row--drag-over { outline: 1px solid var(--accent-blue); }
.drag-handle {
  cursor: grab;
  color: #4b5568;
  font-size: 0.9rem;
  flex-shrink: 0;
  user-select: none;
  padding: 0 0.1rem;
}
.drag-handle:active { cursor: grabbing; }

.item-swatch {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.15);
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.item-duration {
  font-size: 0.7rem;
  color: #c0c8e0;
  font-family: monospace;
  flex-shrink: 0;
}

.item-edit {
  background: none;
  border: none;
  color: #c0c8e0;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.1rem 0.2rem;
  border-radius: 3px;
  flex-shrink: 0;
  line-height: 1;
}
.item-edit:hover { color: var(--accent-blue); }

.item-remove {
  background: none;
  border: none;
  color: #c0c8e0;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.1rem 0.2rem;
  border-radius: 3px;
  flex-shrink: 0;
  line-height: 1;
}
.item-remove:hover { color: var(--accent-red); }

.item-state {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  flex-shrink: 0;
}
.item-state--on  { background: rgba(240,192,64,0.2); color: #f0c040; }
.item-state--off { background: rgba(255,255,255,0.06); color: var(--text-muted); }

.fade-backdrop { z-index: 1020; }
.fade-dialog { width: 360px; }
.fade-duration { margin-top: 0.25rem; }

.ha-backdrop { z-index: 1020; }
.random-backdrop { z-index: 1020; }

.ch-check {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: var(--accent-blue);
}
.ha-dialog { width: 420px; }

.ha-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
}

.ha-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ha-name {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.ha-page {
  font-size: 0.7rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.ha-toggle {
  display: flex;
  gap: 0.2rem;
  flex-shrink: 0;
}

.ha-btn {
  font-size: 0.65rem;
  font-family: inherit;
  font-weight: 600;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1.4;
  transition: background 0.12s, color 0.12s;
}
.ha-btn--on  { background: rgba(240,192,64,0.2); color: #f0c040; border-color: #f0c040; }
.ha-btn--off { background: rgba(255,255,255,0.08); color: var(--text-primary); border-color: var(--text-muted); }

.sl-btn {
  font-size: 0.68rem;
  font-family: inherit;
  font-weight: 600;
  padding: 0.1rem 0;
  width: 20px;
  box-sizing: border-box;
  text-align: center;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1.4;
  transition: border-color 0.12s;
}
.sl-btn:hover { border-color: #5090d0; }
.duration-row { margin-top: 0.35rem; gap: 0.6rem; }
.duration-divider { height: 0.6rem; }
.random-fields-grid {
  display: grid;
  grid-template-columns: max-content 8ch;
  align-items: center;
  gap: 0.35rem 0.6rem;
  margin-top: 0.35rem;
}
.sl-btn--val { width: 30px; box-sizing: border-box; text-align: center; }

.dialog-error { font-size: 0.8rem; color: var(--accent-red); }
.dialog-actions { display: flex; justify-content: space-between; align-items: center; }
.dialog-actions-right { display: flex; gap: 0.5rem; }
.dialog-delete {
  background: transparent; color: var(--accent-red);
  border: 1px solid var(--accent-red); border-radius: 6px;
  font-size: 0.875rem; font-family: inherit; padding: 0.5rem 1.25rem; cursor: pointer;
}
.dialog-delete:hover { background: var(--accent-red); color: #fff; }
.dialog-cancel, .dialog-confirm {
  border: none; border-radius: 6px;
  font-size: 0.875rem; font-family: inherit; padding: 0.5rem 1.25rem; cursor: pointer;
}
.dialog-cancel { background: #2a3150; color: #9aa3bc; border: 1px solid #3d4870; }
.dialog-cancel:hover { background: #313858; }
.dialog-confirm { background: var(--accent-blue); color: #fff; }
.dialog-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
