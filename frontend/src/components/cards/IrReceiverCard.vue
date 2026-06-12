<template>
  <div class="card ir-receiver-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiRemote" /></svg>
      {{ card.title || 'IR Devices' }}
    </div>
    <div v-if="!devices.length" class="empty-msg">No devices configured</div>
    <div v-else class="device-list">
      <div v-for="d in devices" :key="d.id" class="device-row">
        <span class="device-name">{{ d.name }}</span>
        <span class="device-type-badge">{{ TYPE_LABELS[d.type] ?? d.type }}</span>
        <button class="remote-btn" @click="openRemote(d)">Remote</button>
        <button v-if="editing" class="row-edit-btn" @click.stop="openEdit(d)">✎</button>
      </div>
    </div>
  </div>

  <!-- Remote overlay (desktop) -->
  <IrRemoteOverlay
    v-if="activeRemote && !isMobile"
    :device="activeRemote"
    @close="activeRemote = null"
  />

  <!-- Device edit dialog -->
  <Teleport to="body">
    <div v-if="dialog" class="dialog-backdrop" @click.self="closeDialog">
      <div class="dialog">
        <h3 class="dialog-title">{{ dialog.isNew ? 'Add Device' : 'Edit Device' }}</h3>

        <div class="fields">
          <label class="field-label">Name</label>
          <input class="field-input" v-model="dialog.name" placeholder="Living Room TV" />

          <label class="field-label">Type</label>
          <select class="field-input" v-model="dialog.type">
            <option value="philips_tv">Philips TV</option>
            <option value="lg_tv">LG TV</option>
            <option value="soundbar">Soundbar</option>
          </select>

          <label class="field-label">Transmitter</label>
          <select class="field-input" v-model="dialog.transmitter_id">
            <option value="">— select —</option>
            <option v-for="t in transmitters" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>

        <div class="commands-section">
          <div class="commands-header">
            IR Commands
            <span class="commands-hint">Click Learn, then point remote at ESP32</span>
          </div>
          <div class="commands-grid">
            <template v-for="cmd in commandsForType(dialog.type)" :key="cmd.key">
              <span class="cmd-label">{{ cmd.label }}</span>
              <input
                class="field-input cmd-input"
                :value="codeDisplay(dialog.commands[cmd.key])"
                placeholder="not learned"
                readonly
              />
              <button
                class="learn-btn"
                :class="{ 'learn-btn--active': learnTarget === cmd.key }"
                @click="toggleLearn(cmd.key)"
              >{{ learnTarget === cmd.key ? 'Listening…' : 'Learn' }}</button>
            </template>
          </div>
        </div>

        <div v-if="dialog.error" class="dialog-error">{{ dialog.error }}</div>
        <div class="dialog-actions">
          <button v-if="!dialog.isNew" class="dialog-delete" @click="deleteDevice">Delete</button>
          <span v-else></span>
          <div class="dialog-actions-right">
            <button class="dialog-cancel" @click="closeDialog">Cancel</button>
            <button class="dialog-confirm" :disabled="!dialog.name.trim()" @click="saveDevice">OK</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
export const icon = '📺';
</script>

<script setup>
import { ref, inject, computed, onMounted, onUnmounted, watch } from 'vue';
import { mdiRemote } from '@mdi/js';
import { useMqtt } from '../../composables/useMqtt.js';
import { useMqttStore } from '../../stores/mqttStore.js';
import IrRemoteOverlay from '../IrRemoteOverlay.vue';

const props = defineProps({ card: { type: Object, required: true } });
const emit  = defineEmits(['open-remote']);
const editing = inject('editing', ref(false));
const { publish } = useMqtt();
const mqttStore = useMqttStore();

const configKey = computed(() => props.card.config_key || props.card.title || 'default');

const TYPE_LABELS = { philips_tv: 'Philips TV', lg_tv: 'LG TV', soundbar: 'Soundbar' };

const COMMANDS = {
  philips_tv: [
    { key: 'power', label: 'Power' }, { key: 'vol_up', label: 'Vol +' }, { key: 'vol_down', label: 'Vol -' },
    { key: 'mute', label: 'Mute' }, { key: 'ch_up', label: 'CH +' }, { key: 'ch_down', label: 'CH -' },
    { key: 'up', label: 'Up' }, { key: 'down', label: 'Down' }, { key: 'left', label: 'Left' },
    { key: 'right', label: 'Right' }, { key: 'ok', label: 'OK' }, { key: 'back', label: 'Back' },
    { key: 'home', label: 'Home' }, { key: 'source', label: 'Source' }, { key: 'info', label: 'Info' },
    { key: 'options', label: 'Options' }, { key: 'play_pause', label: 'Play/Pause' },
    { key: 'previous', label: 'Previous' }, { key: 'next', label: 'Next' },
    { key: 'rewind', label: 'Rewind' }, { key: 'fast_forward', label: 'FF' }, { key: 'stop', label: 'Stop' },
    { key: 'red', label: 'Red' }, { key: 'green', label: 'Green' }, { key: 'yellow', label: 'Yellow' }, { key: 'blue', label: 'Blue' },
  ],
  lg_tv: [
    { key: 'power', label: 'Power' }, { key: 'vol_up', label: 'Vol +' }, { key: 'vol_down', label: 'Vol -' },
    { key: 'mute', label: 'Mute' }, { key: 'ch_up', label: 'CH +' }, { key: 'ch_down', label: 'CH -' },
    { key: 'up', label: 'Up' }, { key: 'down', label: 'Down' }, { key: 'left', label: 'Left' },
    { key: 'right', label: 'Right' }, { key: 'ok', label: 'OK' }, { key: 'back', label: 'Back' },
    { key: 'home', label: 'Home' }, { key: 'source', label: 'Source' }, { key: 'info', label: 'Info' },
    { key: 'settings', label: 'Settings' }, { key: 'play_pause', label: 'Play/Pause' },
    { key: 'previous', label: 'Previous' }, { key: 'next', label: 'Next' },
  ],
  soundbar: [
    { key: 'power', label: 'Power' }, { key: 'vol_up', label: 'Vol +' },
    { key: 'vol_down', label: 'Vol -' }, { key: 'mute', label: 'Mute' },
  ],
};

function commandsForType(type) { return COMMANDS[type] ?? COMMANDS.philips_tv; }
function codeDisplay(v) {
  if (!v) return '';
  if (typeof v === 'object') return v.protocol ? `${v.protocol} ${v.code}` : JSON.stringify(v);
  return String(v);
}

// ── Devices ───────────────────────────────────────────────────────────────────
const devices = ref([]);

async function fetchDevices() {
  try {
    const res = await fetch(`/api/ir-receivers/${encodeURIComponent(configKey.value)}`);
    if (res.ok) devices.value = await res.json();
  } catch { /* ignore */ }
}

async function patchDevices(list) {
  await fetch(`/api/ir-receivers/${encodeURIComponent(configKey.value)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(list),
  });
  await fetchDevices();
}

// ── Transmitters ──────────────────────────────────────────────────────────────
const transmitters = ref([]);
async function fetchTransmitters() {
  try {
    const res = await fetch('/api/ir-devices');
    if (res.ok) transmitters.value = await res.json();
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchDevices();
  fetchTransmitters();
  window.addEventListener('ir-devices-updated', fetchTransmitters);
});
onUnmounted(() => {
  window.removeEventListener('ir-devices-updated', fetchTransmitters);
  stopLearn();
});

// ── Remote overlay ────────────────────────────────────────────────────────────
const activeRemote = ref(null);
const isMobile = computed(() => window.innerWidth < 640);

function openRemote(device) {
  if (isMobile.value) emit('open-remote', device);
  else activeRemote.value = device;
}

// ── Device edit dialog ────────────────────────────────────────────────────────
const dialog = ref(null);
const learnTarget = ref(null);
let learnTimer = null;

function openAdd() {
  dialog.value = {
    id: Date.now().toString(36),
    name: '', type: 'philips_tv', transmitter_id: '',
    commands: {}, isNew: true, error: '',
  };
}
function openEdit(d) {
  dialog.value = { ...d, commands: { ...(d.commands ?? {}) }, isNew: false, error: '' };
}
function closeDialog() { stopLearn(); dialog.value = null; }

// ── IR Learn ──────────────────────────────────────────────────────────────────
function toggleLearn(cmdKey) {
  if (learnTarget.value === cmdKey) { stopLearn(); return; }
  stopLearn();
  const tid = dialog.value?.transmitter_id;
  if (!tid) { dialog.value.error = 'Select a transmitter first'; return; }
  dialog.value.error = '';
  learnTarget.value = cmdKey;
  publish(`ir/${tid}/learn`, cmdKey);
  learnTimer = setTimeout(() => stopLearn(), 15000);
}
function stopLearn() { clearTimeout(learnTimer); learnTarget.value = null; }

watch(() => {
  const tid = dialog.value?.transmitter_id;
  return tid ? mqttStore.getValue(`ir/${tid}/learned`) : null;
}, (val) => {
  if (!val || !learnTarget.value || !dialog.value) return;
  try {
    dialog.value.commands[learnTarget.value] = typeof val === 'string' ? JSON.parse(val) : val;
  } catch {
    dialog.value.commands[learnTarget.value] = val;
  }
  stopLearn();
});

// ── Save / delete ─────────────────────────────────────────────────────────────
async function saveDevice() {
  const { isNew, error, ...data } = dialog.value;
  if (!data.name.trim()) return;
  let updated;
  if (isNew) updated = [...devices.value, data];
  else updated = devices.value.map(d => d.id === data.id ? data : d);
  await patchDevices(updated);
  closeDialog();
}
async function deleteDevice() {
  await patchDevices(devices.value.filter(d => d.id !== dialog.value.id));
  closeDialog();
}

defineExpose({ openAdd });
</script>

<style scoped>
.ir-receiver-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 8px; padding: 0.5rem 0.65rem 0.4rem;
  display: flex; flex-direction: column; overflow: hidden;
}
.card-header {
  font-size: 0.75rem; font-weight: 500; color: var(--text-secondary);
  letter-spacing: 0.04em; display: flex; align-items: center; gap: 0.3rem;
  padding-bottom: 0.4rem; margin-bottom: 0.25rem;
  border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.header-icon { width: 13px; height: 13px; flex-shrink: 0; }
.empty-msg {
  flex: 1; display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; color: #9aa3bc;
}
.device-list { flex: 1; overflow-y: auto; margin: 0 -0.65rem; }
.device-row {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.3rem 0.65rem; white-space: nowrap; overflow: hidden;
}
.device-row:hover { background: var(--bg-card-hover); }
.device-name { flex: 1; font-size: 0.82rem; color: #e8eaf0; overflow: hidden; text-overflow: ellipsis; }
.device-type-badge {
  font-size: 0.65rem; color: var(--text-muted); background: #1e2840;
  border: 1px solid var(--border); border-radius: 4px; padding: 0.1rem 0.4rem; flex-shrink: 0;
}
.remote-btn {
  font-size: 0.7rem; font-family: inherit; font-weight: 600;
  padding: 0.2rem 0.55rem; border-radius: 5px;
  border: 1px solid #5090d0; background: transparent; color: #5090d0;
  cursor: pointer; flex-shrink: 0; transition: background 0.12s, color 0.12s;
}
.remote-btn:hover { background: #5090d0; color: #fff; }
.row-edit-btn {
  background: none; border: none; color: var(--text-muted); font-size: 0.85rem;
  cursor: pointer; padding: 0.1rem 0.25rem; border-radius: 4px; flex-shrink: 0;
  transition: color 0.15s;
}
.row-edit-btn:hover { color: var(--accent-blue); }

/* Dialog */
.dialog-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.dialog {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 1.5rem; width: 480px; max-height: 85vh;
  overflow-y: auto; display: flex; flex-direction: column; gap: 1rem;
}
.dialog-title { font-size: 1rem; font-weight: 600; color: var(--text-primary); }
.fields { display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem; align-items: center; }
.field-label { font-size: 0.8rem; color: #9aa3bc; white-space: nowrap; }
.field-input {
  background: #2a3150; border: 1px solid #3d4870; border-radius: 5px;
  color: var(--text-primary); font-size: 0.875rem; padding: 0.35rem 0.6rem;
  font-family: inherit; outline: none; width: 100%; box-sizing: border-box;
}
.field-input:focus { border-color: var(--accent-blue); }
.commands-section { display: flex; flex-direction: column; gap: 0.5rem; }
.commands-header {
  font-size: 0.75rem; font-weight: 600; color: #6b7694;
  text-transform: uppercase; letter-spacing: 0.05em;
  display: flex; align-items: center; gap: 0.75rem;
}
.commands-hint { font-size: 0.7rem; color: var(--text-muted); text-transform: none; letter-spacing: normal; font-weight: 400; }
.commands-grid {
  display: grid; grid-template-columns: 90px 1fr auto;
  gap: 0.35rem 0.5rem; align-items: center;
}
.cmd-label { font-size: 0.78rem; color: #9aa3bc; white-space: nowrap; }
.cmd-input { font-size: 0.72rem; font-family: monospace; cursor: default; }
.learn-btn {
  font-size: 0.7rem; font-family: inherit; font-weight: 600;
  padding: 0.2rem 0.5rem; border-radius: 4px; white-space: nowrap;
  border: 1px solid #3d4870; background: transparent; color: var(--text-muted);
  cursor: pointer; transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.learn-btn:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
.learn-btn--active { border-color: #f59e0b; color: #f59e0b; animation: pulse 1s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
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
  border: none; border-radius: 6px; font-size: 0.875rem;
  font-family: inherit; padding: 0.5rem 1.25rem; cursor: pointer;
}
.dialog-cancel { background: #2a3150; color: #9aa3bc; border: 1px solid #3d4870; }
.dialog-cancel:hover { background: #313858; }
.dialog-confirm { background: var(--accent-blue); color: #fff; }
.dialog-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
