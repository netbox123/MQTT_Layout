<template>
  <div class="card automations-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiRobot" /></svg>
      <span class="header-title">{{ card.title || 'Automations' }}</span>
      <span v-if="sun" class="sun-state" :title="`Sun elevation ${sun.elevation}°`">
        <svg viewBox="0 0 24 24" fill="currentColor" class="sun-icon">
          <path :d="sun.below_horizon ? mdiWeatherNight : mdiWeatherSunny" />
        </svg>
        {{ sun.below_horizon ? 'Dark' : 'Light' }}
      </span>
    </div>

    <div v-if="loadError" class="empty-msg">Could not load automations</div>
    <div v-else-if="!automations.length" class="empty-msg">No automations in config/automations.json</div>
    <div v-else class="automation-list">
      <div v-for="a in automations" :key="a.id" class="automation-row">
        <span class="status-dot" :class="dotClass(a)"></span>
        <div class="automation-text">
          <span class="automation-name">{{ a.name }}</span>
          <span class="automation-meta" :title="a.last_result ?? ''">{{ metaText(a) }}</span>
        </div>
        <button v-if="editing" class="row-edit-btn" title="Edit automation" @click.stop="openEdit(a)">✎</button>
        <button v-if="editing" class="row-edit-btn row-edit-btn--del" title="Delete automation" @click.stop="deleteAutomation(a)">✕</button>
        <button
          class="toggle"
          :class="{ 'toggle--on': a.enabled }"
          :aria-pressed="a.enabled"
          :title="a.enabled ? 'Enabled: click to disable' : 'Disabled: click to enable'"
          @click="toggle(a)"
        ><span class="toggle-knob"></span></button>
      </div>
    </div>

    <!-- Automation editor -->
    <Teleport to="body">
      <div v-if="form" class="dialog-backdrop" @click.self="form = null">
        <div class="dialog">
          <h3 class="dialog-title">{{ form.id ? 'Edit Automation' : 'New Automation' }}</h3>

          <label class="field">
            <span class="field-label">Name</span>
            <input class="editor-input" type="text" v-model="form.name" placeholder="Shed light on when I come home" />
          </label>

          <div class="editor-section-title">When</div>
          <div class="field">
            <span class="field-label">One of these MQTT topics changes</span>
            <div v-for="(t, i) in form.trigger.topics" :key="'t' + i" class="topic-row">
              <input class="editor-input" type="text" v-model="form.trigger.topics[i]" list="automation-topics" placeholder="homeassistant/person/…/state" />
              <button v-if="form.trigger.topics.length > 1" class="row-edit-btn row-edit-btn--del" title="Remove topic" @click="form.trigger.topics.splice(i, 1)">✕</button>
            </div>
            <button class="add-step-btn" @click="form.trigger.topics.push('')">+ Add topic</button>
          </div>
          <div class="field-row">
            <label class="field">
              <span class="field-label">from</span>
              <input class="editor-input" type="text" v-model="form.trigger.from" placeholder="any value" />
            </label>
            <label class="field">
              <span class="field-label">to</span>
              <input class="editor-input" type="text" v-model="form.trigger.to" placeholder="any value" />
            </label>
          </div>

          <div class="editor-section-title">Only if</div>
          <label class="field">
            <span class="field-label">Sun</span>
            <select class="editor-input" v-model="form.sun">
              <option value="any">Any time</option>
              <option value="below_horizon">Dark (sun below horizon)</option>
              <option value="above_horizon">Light (sun above horizon)</option>
            </select>
          </label>
          <div v-for="(c, i) in form.states" :key="'c' + i" class="step">
            <div class="step-head">
              <span class="step-title">Topic state</span>
              <button class="row-edit-btn row-edit-btn--del" title="Remove condition" @click="form.states.splice(i, 1)">✕</button>
            </div>
            <input class="editor-input" type="text" v-model="c.topic" list="automation-topics" placeholder="topic" />
            <div class="field-row">
              <select class="editor-input editor-input--narrow" v-model="c.op">
                <option value="is">is</option>
                <option value="is_not">is not</option>
              </select>
              <input class="editor-input" type="text" v-model="c.value" placeholder="value, e.g. ON" />
            </div>
          </div>
          <button class="add-step-btn" @click="form.states.push({ topic: '', op: 'is', value: '' })">+ Add state condition</button>

          <div class="editor-section-title">Then</div>
          <div v-for="(s, i) in form.actions" :key="'a' + i" class="step">
            <div class="step-head">
              <span class="step-num">{{ i + 1 }}</span>
              <select class="editor-input editor-input--narrow" v-model="s.type">
                <option value="publish">Publish</option>
                <option value="wait_for">Wait for</option>
                <option value="delay">Delay</option>
              </select>
              <span class="step-spacer"></span>
              <button class="row-edit-btn" title="Move up" :disabled="i === 0" @click="moveAction(i, -1)">↑</button>
              <button class="row-edit-btn" title="Move down" :disabled="i === form.actions.length - 1" @click="moveAction(i, 1)">↓</button>
              <button class="row-edit-btn row-edit-btn--del" title="Remove action" @click="form.actions.splice(i, 1)">✕</button>
            </div>
            <template v-if="s.type === 'publish'">
              <input class="editor-input" type="text" v-model="s.topic" list="automation-command-topics" placeholder="esp32/switch/…/command" />
              <input class="editor-input" type="text" v-model="s.payload" list="automation-payloads" placeholder="payload, e.g. ON" />
            </template>
            <template v-else-if="s.type === 'wait_for'">
              <input class="editor-input" type="text" v-model="s.topic" list="automation-topics" placeholder="topic" />
              <div class="field-row">
                <input class="editor-input" type="text" v-model="s.equals" placeholder="becomes, e.g. disarmed" />
                <label class="inline-field">
                  <span class="field-label">max</span>
                  <input class="editor-input editor-input--num" type="number" min="1" v-model.number="s.timeout_s" />
                  <span class="field-label">s</span>
                </label>
              </div>
              <span class="hint">Stops the automation if the value doesn't arrive in time.</span>
            </template>
            <template v-else>
              <label class="inline-field">
                <input class="editor-input editor-input--num" type="number" min="0" v-model.number="s.seconds" />
                <span class="field-label">seconds</span>
              </label>
            </template>
          </div>
          <button class="add-step-btn" @click="form.actions.push(newAction())">+ Add action</button>

          <label class="field">
            <span class="field-label">If triggered again while still running</span>
            <select class="editor-input" v-model="form.mode">
              <option value="single">Ignore the new trigger</option>
              <option value="restart">Start over (e.g. restart an off-timer)</option>
            </select>
          </label>

          <datalist id="automation-topics">
            <option v-for="t in topics" :key="t" :value="t" />
          </datalist>
          <datalist id="automation-command-topics">
            <option v-for="t in commandTopics" :key="t" :value="t" />
          </datalist>
          <datalist id="automation-payloads">
            <option value="ON" /><option value="OFF" /><option value='{"state":"ON"}' /><option value='{"state":"OFF"}' />
          </datalist>

          <div v-if="formError" class="form-error">{{ formError }}</div>

          <div class="dialog-actions">
            <button v-if="form.id" class="dialog-delete" @click="deleteAutomation(form)">Delete</button>
            <span v-else></span>
            <div class="dialog-actions-right">
              <button class="dialog-cancel" @click="form = null">Cancel</button>
              <button class="dialog-confirm" :disabled="saving" @click="saveForm">Save</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
export const icon = '🤖';
</script>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted } from 'vue';
import { mdiRobot, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js';

defineProps({ card: { type: Object, required: true } });

const automations = ref([]);
const sun = ref(null);
const loadError = ref(false);
const now = ref(Date.now());
const editing = inject('editing', ref(false));

function apply(data) {
  automations.value = data.automations ?? [];
  sun.value = data.sun ?? null;
}

async function load() {
  try {
    const res = await fetch('/api/automations');
    if (!res.ok) throw new Error(res.statusText);
    apply(await res.json());
    loadError.value = false;
  } catch {
    loadError.value = true;
  }
}

function onState(e) { apply(e.detail); loadError.value = false; }

let clock = null;
onMounted(() => {
  load();
  window.addEventListener('automations-state', onState);
  clock = setInterval(() => { now.value = Date.now(); }, 30000);
});
onUnmounted(() => {
  window.removeEventListener('automations-state', onState);
  clearInterval(clock);
});

async function toggle(a) {
  const enabled = !a.enabled;
  a.enabled = enabled; // optimistic; server broadcast confirms
  try {
    const res = await fetch(`/api/automations/${encodeURIComponent(a.id)}/enabled`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error();
  } catch {
    a.enabled = !enabled;
  }
}

function dotClass(a) {
  if (!a.enabled) return 'status-dot--off';
  if (a.running) return 'status-dot--running';
  if (a.last_result && a.last_result !== 'done') return 'status-dot--warn';
  return 'status-dot--on';
}

function relTime(iso) {
  const t = new Date(iso);
  const mins = Math.round((now.value - t.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const today = new Date(now.value);
  const yesterday = new Date(now.value - 86400000);
  if (t.toDateString() === today.toDateString()) return `today ${time}`;
  if (t.toDateString() === yesterday.toDateString()) return `yesterday ${time}`;
  return `${t.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
}

function metaText(a) {
  if (!a.enabled) return 'Disabled';
  if (a.running) return 'Running…';
  if (!a.last_triggered) return 'Never ran';
  const when = relTime(a.last_triggered);
  return a.last_result && a.last_result !== 'done' ? `${when} · ${a.last_result}` : `Last ran ${when}`;
}

// ── Editor ─────────────────────────────────────────────────────────────────
const form = ref(null);
const formError = ref('');
const saving = ref(false);
const topics = ref([]);

// ESPHome switches/lights are controlled on …/command next to their …/state topic
const commandTopics = computed(() => {
  const out = new Set();
  for (const t of topics.value) {
    if (/^esp32\/(switch|light)\/.+\/state$/.test(t)) out.add(t.replace(/\/state$/, '/command'));
  }
  for (const t of topics.value) out.add(t);
  return [...out];
});

async function loadTopics() {
  try {
    const res = await fetch('/api/topics');
    if (res.ok) topics.value = await res.json();
  } catch { /* suggestions are optional */ }
}

function newAction() {
  return { type: 'publish', topic: '', payload: '', equals: '', timeout_s: 60, seconds: 5 };
}

function toForm(a) {
  const sun = (a?.conditions ?? []).find(c => c.type === 'sun');
  return {
    id: a?.id ?? null,
    name: a?.name ?? '',
    enabled: a?.enabled ?? true,
    trigger: {
      topics: Array.isArray(a?.trigger?.topic) ? [...a.trigger.topic] : [a?.trigger?.topic ?? ''],
      from: a?.trigger?.from ?? '',
      to: a?.trigger?.to ?? '',
    },
    mode: a?.mode ?? 'single',
    sun: sun?.state ?? 'any',
    states: (a?.conditions ?? []).filter(c => c.type === 'state').map(c => ({
      topic: c.topic,
      op: c.not_equals !== undefined ? 'is_not' : 'is',
      value: String(c.not_equals ?? c.equals ?? ''),
    })),
    actions: (a?.actions ?? [newAction()]).map(s => ({ ...newAction(), ...s, equals: String(s.equals ?? '') })),
  };
}

function fromForm(f) {
  const conditions = [];
  if (f.sun !== 'any') conditions.push({ type: 'sun', state: f.sun });
  for (const c of f.states) {
    conditions.push(c.op === 'is_not'
      ? { type: 'state', topic: c.topic, not_equals: c.value }
      : { type: 'state', topic: c.topic, equals: c.value });
  }
  const actions = f.actions.map(s =>
    s.type === 'publish'  ? { type: 'publish', topic: s.topic, payload: s.payload } :
    s.type === 'wait_for' ? { type: 'wait_for', topic: s.topic, equals: s.equals, timeout_s: s.timeout_s } :
                            { type: 'delay', seconds: s.seconds });
  const topics = f.trigger.topics.map(t => t.trim()).filter(Boolean);
  return {
    name: f.name,
    enabled: f.enabled,
    mode: f.mode,
    trigger: { topic: topics.length === 1 ? topics[0] : topics, from: f.trigger.from, to: f.trigger.to },
    conditions,
    actions,
  };
}

function openAdd() {
  formError.value = '';
  form.value = toForm(null);
  loadTopics();
}

function openEdit(a) {
  formError.value = '';
  form.value = toForm(a);
  loadTopics();
}

function moveAction(i, dir) {
  const list = form.value.actions;
  [list[i], list[i + dir]] = [list[i + dir], list[i]];
}

async function saveForm() {
  formError.value = '';
  saving.value = true;
  try {
    const id = form.value.id;
    const res = await fetch(id ? `/api/automations/${encodeURIComponent(id)}` : '/api/automations', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fromForm(form.value)),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { formError.value = body.error || 'Could not save'; return; }
    form.value = null;
    load();
  } catch {
    formError.value = 'Could not reach the server';
  } finally {
    saving.value = false;
  }
}

async function deleteAutomation(a) {
  if (!confirm(`Delete automation "${a.name}"?`)) return;
  const res = await fetch(`/api/automations/${encodeURIComponent(a.id)}`, { method: 'DELETE' });
  if (res.ok) { form.value = null; load(); }
}

defineExpose({ openAdd });
</script>

<style scoped>
.automations-card {
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
.header-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sun-state {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.7rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.sun-icon { width: 12px; height: 12px; }

.empty-msg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 0.8rem;
  color: #9aa3bc;
}

.automation-list {
  flex: 1;
  overflow-y: auto;
  margin: 0 -0.65rem;
}

.automation-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.65rem;
}
.automation-row:hover { background: var(--bg-card-hover); }

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #444;
  transition: background 0.2s;
}
.status-dot--on { background: #4caf6e; box-shadow: 0 0 4px #4caf6e; }
.status-dot--running { background: var(--accent-blue); box-shadow: 0 0 4px var(--accent-blue); }
.status-dot--warn { background: var(--accent-yellow); box-shadow: 0 0 4px var(--accent-yellow); }
.status-dot--off { background: #444; }

.automation-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.automation-name {
  font-size: 0.8rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.automation-meta {
  font-size: 0.68rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toggle {
  position: relative;
  width: 30px;
  height: 17px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.2s, border-color 0.2s;
}
.toggle--on { background: var(--accent-green); border-color: var(--accent-green); }
.toggle-knob {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--text-primary);
  transition: transform 0.2s;
}
.toggle--on .toggle-knob { transform: translateX(13px); background: #fff; }

.row-edit-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.1rem 0.25rem;
  border-radius: 4px;
  flex-shrink: 0;
  font-family: inherit;
  transition: color 0.15s;
}
.row-edit-btn:hover:not(:disabled) { color: var(--accent-blue); }
.row-edit-btn--del:hover:not(:disabled) { color: var(--accent-red); }
.row-edit-btn:disabled { opacity: 0.3; cursor: default; }

/* ── Editor dialog ── */
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 2000;
  overflow-y: auto;
  padding: 2rem 16px;
}
.dialog {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.5rem;
  width: 460px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.dialog-title { font-size: 1rem; font-weight: 600; color: var(--text-primary); margin: 0; }
.editor-section-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: #6b7694;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.5rem;
}
.field { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 0; }
.field-row { display: flex; gap: 0.5rem; align-items: flex-end; }
.topic-row { display: flex; gap: 0.3rem; align-items: center; }
.inline-field { display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0; }
.field-label { font-size: 0.75rem; color: #9aa3bc; white-space: nowrap; }
.hint { font-size: 0.7rem; color: var(--text-muted); }
.editor-input {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.85rem;
  padding: 0.3rem 0.5rem;
  font-family: inherit;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.editor-input:focus { border-color: var(--accent-blue); }
.editor-input--narrow { width: auto; flex-shrink: 0; }
.editor-input--num { width: 70px; }

.step {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-card);
}
.step-head { display: flex; align-items: center; gap: 0.4rem; }
.step-title { flex: 1; font-size: 0.75rem; color: #9aa3bc; }
.step-num { font-size: 0.75rem; color: var(--text-muted); min-width: 1rem; }
.step-spacer { flex: 1; }

.add-step-btn {
  align-self: flex-start;
  background: none;
  border: 1px dashed #3d4870;
  border-radius: 5px;
  color: #9aa3bc;
  font-size: 0.78rem;
  font-family: inherit;
  padding: 0.3rem 0.6rem;
  cursor: pointer;
}
.add-step-btn:hover { border-color: var(--accent-blue); color: var(--accent-blue); }

.form-error { font-size: 0.8rem; color: var(--accent-red); }

.dialog-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; }
.dialog-actions-right { display: flex; gap: 0.5rem; }
.dialog-cancel, .dialog-confirm, .dialog-delete {
  border: none; border-radius: 6px;
  font-size: 0.875rem; font-family: inherit; padding: 0.45rem 1rem; cursor: pointer;
}
.dialog-cancel { background: #2a3150; color: #9aa3bc; border: 1px solid #3d4870; }
.dialog-cancel:hover { background: #313858; }
.dialog-confirm { background: var(--accent-blue); color: #fff; }
.dialog-confirm:disabled { opacity: 0.6; cursor: default; }
.dialog-delete { background: none; color: var(--accent-red); border: 1px solid var(--accent-red); }
</style>
