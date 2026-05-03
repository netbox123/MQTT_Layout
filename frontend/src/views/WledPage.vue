<template>
  <div class="wled-page">
    <div class="wled-header">
      <h1 class="wled-title">WLED Devices</h1>
      <button class="add-btn" @click="openAdd">+ Add device</button>
    </div>

    <div class="device-list">
      <div v-if="!devices.length" class="empty">No devices configured</div>
      <div v-for="d in devices" :key="d.id" class="device-row">
        <span class="dot" :class="isOnline(d) ? 'dot--on' : 'dot--off'"></span>
        <span class="device-name">{{ d.name }}</span>
        <span class="device-prefix">wled/{{ d.id }}</span>
        <a v-if="d.ip" class="device-ip" :href="`http://${d.ip}`" target="_blank" rel="noopener" @click.stop>{{ d.ip }}</a>
        <button class="edit-btn" @click="openEdit(d)">✎</button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="dialog" class="dialog-backdrop" @click.self="dialog = null">
        <div class="dialog">
          <h3 class="dialog-title">{{ dialog.isNew ? 'Add Device' : 'Edit Device' }}</h3>
          <div class="fields">
            <label class="field-label">Name</label>
            <input class="field-input" v-model="dialog.name" placeholder="Living Room Strip" />
            <label class="field-label">WLED ID</label>
            <input class="field-input" v-model="dialog.id" placeholder="c18cbc" :disabled="!dialog.isNew" />
            <label class="field-label">IP address</label>
            <input class="field-input" v-model="dialog.ip" placeholder="192.168.0.x" />
            <label class="field-label">Topic prefix</label>
            <span class="field-preview">wled/{{ dialog.id || '…' }}</span>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useMqttStore } from '../stores/mqttStore.js';

const mqttStore = useMqttStore();
const devices = ref([]);

async function fetchDevices() {
  try {
    const res = await fetch('/api/wled-devices');
    if (res.ok) devices.value = await res.json();
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchDevices();
  window.addEventListener('wled-devices-updated', fetchDevices);
});
onUnmounted(() => window.removeEventListener('wled-devices-updated', fetchDevices));

function isOnline(d) {
  return mqttStore.topicValues[`wled/${d.id}/status`] === 'online';
}

const dialog = ref(null);

function openAdd() {
  dialog.value = { name: '', id: '', ip: '', isNew: true, error: '' };
}

function openEdit(d) {
  dialog.value = { ...d, isNew: false, error: '' };
}

async function saveDevice() {
  const { isNew, error, _original, ...data } = dialog.value;
  if (!data.name.trim() || !data.id.trim()) return;
  data.id = data.id.trim();
  data.name = data.name.trim();

  let updated;
  if (isNew) {
    if (devices.value.find(d => d.id === data.id)) {
      dialog.value.error = 'ID already exists';
      return;
    }
    updated = [...devices.value, data];
  } else {
    updated = devices.value.map(d => d.id === data.id ? data : d);
  }
  await patch(updated);
  dialog.value = null;
}

async function deleteDevice() {
  const updated = devices.value.filter(d => d.id !== dialog.value.id);
  await patch(updated);
  dialog.value = null;
}

async function patch(list) {
  await fetch('/api/wled-devices', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(list),
  });
  window.dispatchEvent(new CustomEvent('wled-devices-updated'));
}
</script>

<style scoped>
.wled-page {
  max-width: 600px;
  padding: 0.25rem 0;
}

.wled-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.wled-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.add-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--accent-blue);
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
}
.add-btn:hover { background: var(--bg-card); }

.device-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.empty {
  padding: 1rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.device-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-card);
  transition: background 0.15s;
}
.device-row:last-child { border-bottom: none; }
.device-row:hover { background: var(--bg-card-hover); }

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--on  { background: #4caf6e; box-shadow: 0 0 4px #4caf6e; }
.dot--off { background: #444; }

.device-name {
  flex: 1;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.device-prefix {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: monospace;
}

.device-ip {
  font-size: 0.75rem;
  color: var(--accent-blue);
  font-family: monospace;
  text-decoration: none;
}
.device-ip:hover { text-decoration: underline; }

.edit-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  transition: color 0.15s;
  flex-shrink: 0;
}
.edit-btn:hover { color: var(--accent-blue); }

/* Dialog */
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.5rem;
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.fields {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
  align-items: center;
}

.field-label {
  font-size: 0.8rem;
  color: #9aa3bc;
  white-space: nowrap;
}

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
.field-input:disabled { opacity: 0.5; cursor: not-allowed; }

.field-preview {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-family: monospace;
}

.dialog-error {
  font-size: 0.8rem;
  color: var(--accent-red);
}

.dialog-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dialog-actions-right { display: flex; gap: 0.5rem; }

.dialog-delete {
  background: transparent;
  color: var(--accent-red);
  border: 1px solid var(--accent-red);
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  cursor: pointer;
}
.dialog-delete:hover { background: var(--accent-red); color: #fff; }

.dialog-cancel, .dialog-confirm {
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  cursor: pointer;
}
.dialog-cancel { background: #2a3150; color: #9aa3bc; border: 1px solid #3d4870; }
.dialog-cancel:hover { background: #313858; }
.dialog-confirm { background: var(--accent-blue); color: #fff; }
.dialog-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
