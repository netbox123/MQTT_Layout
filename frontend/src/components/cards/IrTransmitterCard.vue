<template>
  <div class="card ir-transmitter-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiRemote" /></svg>
      {{ card.title || 'IR Transmitters' }}
    </div>
    <div v-if="!devices.length" class="empty-msg">No transmitters configured</div>
    <div v-else class="device-list">
      <div v-for="d in devices" :key="d.id" class="device-row">
        <svg viewBox="0 0 24 24" fill="currentColor" class="row-icon"><path :d="mdiAccessPointNetwork" /></svg>
        <span class="device-name">{{ d.name }}</span>
        <span class="device-topic">ir/{{ d.id }}</span>
        <a v-if="d.ip" class="device-ip" :href="`http://${d.ip}`" target="_blank" rel="noopener" @click.stop>{{ d.ip }}</a>
        <button v-if="editing" class="row-edit-btn" @click.stop="openEdit(d)">✎</button>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="dialog" class="dialog-backdrop" @click.self="dialog = null">
      <div class="dialog">
        <h3 class="dialog-title">{{ dialog.isNew ? 'Add IR Transmitter' : 'Edit IR Transmitter' }}</h3>
        <div class="fields">
          <label class="field-label">Name</label>
          <input class="field-input" v-model="dialog.name" placeholder="Living Room IR" />
          <label class="field-label">ID</label>
          <input class="field-input" v-model="dialog.id" placeholder="ir1" :disabled="!dialog.isNew" />
          <label class="field-label">IP address</label>
          <input class="field-input" v-model="dialog.ip" placeholder="192.168.0.x" />
          <label class="field-label">MQTT topic</label>
          <span class="field-preview">ir/{{ dialog.id || '…' }}/transmit</span>
        </div>
        <div v-if="dialog.error" class="dialog-error">{{ dialog.error }}</div>
        <div class="dialog-actions">
          <button v-if="!dialog.isNew" class="dialog-delete" @click="deleteDevice">Delete</button>
          <span v-else></span>
          <div class="dialog-actions-right">
            <button class="dialog-cancel" @click="dialog = null">Cancel</button>
            <button class="dialog-confirm" :disabled="!dialog.name.trim() || !dialog.id.trim()" @click="saveDevice">OK</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
export const icon = '📡';
</script>

<script setup>
import { ref, inject, onMounted, onUnmounted } from 'vue';
import { mdiRemote, mdiAccessPointNetwork } from '@mdi/js';

const props = defineProps({ card: { type: Object, required: true } });
const editing = inject('editing', ref(false));
const devices = ref([]);

async function fetchDevices() {
  try {
    const res = await fetch('/api/ir-devices');
    if (res.ok) devices.value = await res.json();
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchDevices();
  window.addEventListener('ir-devices-updated', fetchDevices);
});
onUnmounted(() => window.removeEventListener('ir-devices-updated', fetchDevices));

const dialog = ref(null);

function openAdd() {
  dialog.value = { name: '', id: '', ip: '', isNew: true, error: '' };
}
function openEdit(d) {
  dialog.value = { ...d, isNew: false, error: '' };
}

async function saveDevice() {
  const { isNew, error, ...data } = dialog.value;
  data.id   = data.id.trim();
  data.name = data.name.trim();
  if (!data.name || !data.id) return;
  let updated;
  if (isNew) {
    if (devices.value.find(d => d.id === data.id)) { dialog.value.error = 'ID already exists'; return; }
    updated = [...devices.value, data];
  } else {
    updated = devices.value.map(d => d.id === data.id ? data : d);
  }
  await patch(updated);
  dialog.value = null;
}

async function deleteDevice() {
  await patch(devices.value.filter(d => d.id !== dialog.value.id));
  dialog.value = null;
}

async function patch(list) {
  await fetch('/api/ir-devices', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(list),
  });
  window.dispatchEvent(new CustomEvent('ir-devices-updated'));
  await fetchDevices();
}

defineExpose({ openAdd });
</script>

<style scoped>
.ir-transmitter-card {
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
.empty-msg {
  flex: 1; display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; color: #9aa3bc;
}
.device-list { flex: 1; overflow-y: auto; margin: 0 -0.65rem; }
.device-row {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.22rem 0.65rem; white-space: nowrap; overflow: hidden;
}
.device-row:hover { background: var(--bg-card-hover); }
.row-icon { width: 12px; height: 12px; color: var(--text-muted); flex-shrink: 0; }
.device-name { flex: 1; font-size: 0.8rem; color: #e8eaf0; overflow: hidden; text-overflow: ellipsis; }
.device-topic { font-size: 0.7rem; color: var(--text-muted); font-family: monospace; flex-shrink: 0; }
.device-ip {
  font-size: 0.7rem; color: var(--accent-blue); font-family: monospace;
  text-decoration: none; flex-shrink: 0;
}
.device-ip:hover { text-decoration: underline; }
.row-edit-btn {
  background: none; border: none; color: var(--text-muted); font-size: 0.85rem;
  cursor: pointer; padding: 0.1rem 0.25rem; border-radius: 4px; flex-shrink: 0; transition: color 0.15s;
}
.row-edit-btn:hover { color: var(--accent-blue); }

/* Dialog */
.dialog-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.dialog {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 1.5rem; width: 340px;
  display: flex; flex-direction: column; gap: 1rem;
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
.field-input:disabled { opacity: 0.5; cursor: not-allowed; }
.field-preview { font-size: 0.8rem; color: var(--text-muted); font-family: monospace; }
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
