<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">GIGA Boot Config</h2>
        <p class="modal-hint">Values the GIGA sends to the ESP32 mainboard at boot, before it unlocks into <code>calibrate</code>. Prepared ahead of the GIGA firmware — same field names as <code>docs/software.md</code>. <code>pilot_name</code>/<code>pilot_weight_kg</code> are entered live on the winchman controller itself, per tow — not here.</p>

        <div class="section-title">Connection</div>
        <div class="fields">
          <label class="field-label">GIGA IP address</label>
          <div class="ip-row">
            <input class="field-input" type="text" placeholder="192.168.0.50" v-model="gigaIp" @blur="saveIpAndCheck" @keyup.enter="saveIpAndCheck" />
            <span class="status-dot" :class="statusClass" :title="statusLabel"></span>
          </div>
        </div>
        <p v-if="syncMessage" class="sync-message" :class="{ 'sync-message--error': syncError }">{{ syncMessage }}</p>

        <div class="section-title">Boot</div>
        <div class="fields">
          <label class="field-label">operating_mode</label>
          <select class="field-input" v-model="fields.operating_mode">
            <option value="winchman">winchman</option>
            <option value="solo">solo</option>
          </select>
        </div>

        <div class="section-title">Calibration</div>
        <div class="fields">
          <label class="field-label">use_saved_calibration</label>
          <label class="field-checkbox">
            <input type="checkbox" v-model="fields.use_saved_calibration" />
            <span>{{ fields.use_saved_calibration ? 'Yes' : 'No' }}</span>
          </label>
          <label class="field-label">cal_raw_zero</label>
          <input class="field-input" type="number" step="1" v-model.number="fields.cal_raw_zero" />
          <label class="field-label">cal_raw_100kg</label>
          <input class="field-input" type="number" step="1" v-model.number="fields.cal_raw_100kg" />
        </div>

        <div class="section-title">Tow profile</div>
        <div class="fields">
          <label class="field-label">under_tree_height_reduction_pct</label>
          <input class="field-input" type="number" step="1" v-model.number="fields.under_tree_height_reduction_pct" />
          <label class="field-label">start_reduction_pct</label>
          <input class="field-input" type="number" step="1" v-model.number="fields.start_reduction_pct" />
          <label class="field-label">treeheight_to_full_tow_ramp_s</label>
          <input class="field-input" type="number" step="0.1" v-model.number="fields.treeheight_to_full_tow_ramp_s" />
          <label class="field-label">start_to_treeheight_ramp_s</label>
          <input class="field-input" type="number" step="0.1" v-model.number="fields.start_to_treeheight_ramp_s" />
          <label class="field-label">release_before_taking_in_s</label>
          <input class="field-input" type="number" step="0.1" v-model.number="fields.release_before_taking_in_s" />
        </div>

        <div class="section-title">PID</div>
        <div class="fields">
          <label class="field-label">pid_kp</label>
          <input class="field-input" type="number" step="0.01" v-model.number="fields.pid_kp" />
          <label class="field-label">pid_ki</label>
          <input class="field-input" type="number" step="0.01" v-model.number="fields.pid_ki" />
          <label class="field-label">pid_kd</label>
          <input class="field-input" type="number" step="0.01" v-model.number="fields.pid_kd" />
        </div>

        <div v-if="saveError" class="save-error">{{ saveError }}</div>

        <div class="modal-actions">
          <div class="modal-actions-left">
            <button class="modal-secondary" :disabled="!reachable || syncing" @click="pushToWinch" :title="reachable ? 'Send this config to the GIGA' : 'GIGA not reachable'">To winch</button>
            <button class="modal-secondary" :disabled="!reachable || syncing" @click="pullFromWinch" :title="reachable ? 'Fetch config + new tow records from the GIGA' : 'GIGA not reachable'">From winch</button>
          </div>
          <div class="modal-actions-right">
            <button class="modal-cancel" @click="$emit('cancel')">Cancel</button>
            <button class="modal-confirm" @click="save">OK</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useTowStore } from '../../stores/towStore.js';

const emit = defineEmits(['cancel', 'saved']);

const fields = reactive({
  operating_mode: 'winchman',
  use_saved_calibration: false,
  cal_raw_zero: 0,
  cal_raw_100kg: 0,
  under_tree_height_reduction_pct: 40,
  start_reduction_pct: 60,
  treeheight_to_full_tow_ramp_s: 4,
  start_to_treeheight_ramp_s: 3,
  release_before_taking_in_s: 2,
  pid_kp: 0,
  pid_ki: 0,
  pid_kd: 0,
});

const saveError = ref('');

onMounted(async () => {
  try {
    const res = await fetch('/api/giga-config');
    const data = await res.json();
    Object.assign(fields, data);
  } catch { /* keep defaults */ }
  try {
    const res = await fetch('/api/giga-connection');
    const data = await res.json();
    gigaIp.value = data.ip ?? '';
  } catch { /* keep default */ }
  if (gigaIp.value) checkStatus();
});

// Shared by the OK button and by pushToWinch (which needs the fields
// saved first - otherwise it pushes whatever was last written to
// giga_boot_config.json, not whatever's currently typed into the form).
async function saveFieldsToServer() {
  const res = await fetch('/api/giga-config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields }),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function save() {
  saveError.value = '';
  try {
    await saveFieldsToServer();
  } catch (err) {
    saveError.value = 'Failed to save: ' + err.message;
    return;
  }
  emit('saved');
}

// ── Connection + sync ────────────────────────────────────────────────────
const towStore = useTowStore();

const gigaIp = ref('');
const reachable = ref(false);   // last known reachability
const checking = ref(false);
const syncing = ref(false);
const syncMessage = ref('');
const syncError = ref(false);

const statusClass = computed(() => {
  if (checking.value) return 'status-dot--checking';
  return reachable.value ? 'status-dot--on' : 'status-dot--off';
});
const statusLabel = computed(() => {
  if (checking.value) return 'Checking…';
  return reachable.value ? 'GIGA reachable' : 'GIGA not reachable';
});

async function saveIpAndCheck() {
  try {
    await fetch('/api/giga-connection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: gigaIp.value.trim() }),
    });
  } catch { /* ignore */ }
  checkStatus();
}

async function checkStatus() {
  checking.value = true;
  try {
    const res = await fetch('/api/giga-sync/status');
    const data = await res.json();
    reachable.value = !!data.reachable;
  } catch {
    reachable.value = false;
  } finally {
    checking.value = false;
  }
}

async function pushToWinch() {
  syncing.value = true;
  syncMessage.value = '';
  syncError.value = false;
  try {
    // Virtual "OK" click - save whatever's currently in the form before
    // syncing, so the GIGA gets what's on screen, not the last-saved file.
    await saveFieldsToServer();
    const res = await fetch('/api/giga-sync/push', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'push failed');
    syncMessage.value = 'Config sent to the GIGA.';
  } catch (err) {
    syncError.value = true;
    syncMessage.value = err.message;
  } finally {
    syncing.value = false;
  }
}

async function pullFromWinch() {
  syncing.value = true;
  syncMessage.value = '';
  syncError.value = false;
  try {
    const res = await fetch('/api/giga-sync/pull', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'pull failed');
    if (data.configUpdated) {
      const cfgRes = await fetch('/api/giga-config');
      Object.assign(fields, await cfgRes.json());
    }
    syncMessage.value = `Imported ${data.towsImported} tow(s), ${data.towsSkipped} already had a matching name.`;
    if (data.towsImported > 0) await towStore.refresh();
  } catch (err) {
    syncError.value = true;
    syncMessage.value = err.message;
  } finally {
    syncing.value = false;
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 1000;
  overflow-y: auto;
  padding: 2rem 0;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.75rem;
  width: 420px;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-hint {
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: 0.25rem;
}

.modal-hint code {
  font-size: 0.75rem;
  color: var(--text-primary);
  background: var(--bg-card);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
}

.section-title {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--accent-yellow);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 0.4rem;
}

.ip-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-muted);
}
.status-dot--on { background: var(--accent-green); }
.status-dot--off { background: var(--accent-red); }
.status-dot--checking { background: var(--accent-yellow); }

.sync-message {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: -0.15rem;
}
.sync-message--error { color: var(--accent-red); }

.fields {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 0.75rem;
  align-items: center;
}

.field-label {
  font-size: 0.78rem;
  color: #9aa3bc;
  white-space: nowrap;
}

.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
}

.field-input {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.85rem;
  padding: 0.3rem 0.55rem;
  font-family: inherit;
  outline: none;
  width: 100%;
}

.field-input:focus { border-color: var(--accent-blue); }

.save-error { font-size: 0.8rem; color: var(--accent-red); }

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
}

.modal-actions-left { display: flex; gap: 0.5rem; }
.modal-actions-right { display: flex; gap: 0.5rem; }

.modal-cancel, .modal-confirm, .modal-secondary {
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  cursor: pointer;
}

.modal-cancel { background: #2a3150; color: #9aa3bc; border: 1px solid #3d4870; }
.modal-cancel:hover { background: #313858; }
.modal-confirm { background: var(--accent-blue); color: #fff; }

.modal-secondary { background: #2a3150; color: #9aa3bc; border: 1px solid #3d4870; }
.modal-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
