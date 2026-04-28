<template>
  <nav class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <div class="sidebar-header">
      <button class="collapse-btn" @click="collapsed = !collapsed" :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'">
        <svg viewBox="0 0 24 24" width="16" height="16"><path :d="collapsed ? mdiChevronRight : mdiChevronLeft" fill="currentColor" /></svg>
      </button>
      <div class="sidebar-brand" @click="reloadPage" style="cursor:pointer">
        <svg class="mosquitto-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path :d="mdiHomeAssistant" fill="#18BCF2" />
        </svg>
        <span class="sidebar-title">Home Assistant</span>
      </div>
    </div>
    <ul class="nav-list">

      <li v-for="page in sortedPages" :key="page.path" class="nav-item">
        <router-link :to="page.path" class="nav-link" active-class="nav-link--active" :title="collapsed ? page.name : undefined">
          <svg v-if="page.icon && ICON_MAP[page.icon]" class="nav-icon-svg" :viewBox="ICON_VIEWBOXES[page.icon] || '0 0 24 24'" width="16" height="16"><path :d="ICON_MAP[page.icon]" fill="currentColor" /></svg>
          <span v-else-if="collapsed" class="nav-icon-fallback">{{ page.name[0] }}</span>
          <span class="nav-link-text">{{ page.name }}</span>
        </router-link>
        <button v-if="editing && !collapsed" class="page-edit-btn" title="Edit page" @click="startEditing(page)">✎</button>
      </li>
    </ul>
    <div class="sidebar-footer">
      <span class="status-dot" :class="`status-dot--${status}`"></span>
      <button class="status-label" @click="openMqttSettings">{{ statusLabel }}</button>
      <div class="footer-actions">
        <button v-if="editing" class="add-btn" @click="startAdding" title="Add page">+</button>
        <button class="edit-btn" :class="{ 'edit-btn--active': editing }" @click="editing = !editing" title="Edit pages">✎</button>
      </div>
    </div>
    <Teleport to="body">
      <div v-if="editingPage" class="modal-backdrop" @click.self="cancelEditing">
        <div class="modal">
          <h2 class="modal-title">Edit Page</h2>
          <form @submit.prevent="submitRename">
            <div class="modal-fields">
              <div class="modal-row">
                <label class="modal-label">Mobile</label>
                <label class="modal-checkbox">
                  <input type="checkbox" v-model="editMobile" />
                  <span>{{ editMobile ? 'Yes' : 'No' }}</span>
                </label>
                <label class="modal-label">Order</label>
                <input
                  v-model.number="editOrder"
                  class="modal-input modal-input--short"
                  type="number"
                  min="0"
                />
              </div>
              <label class="modal-label">Name</label>
              <input
                ref="renameInput"
                v-model="editName"
                class="modal-input"
                placeholder="Page name"
                maxlength="40"
              />
              <label class="modal-label">Icon</label>
              <button type="button" class="icon-field" @click="iconPickerOpen = true">
                <svg v-if="editIcon && ICON_MAP[editIcon]" viewBox="0 0 24 24" width="20" height="20"><path :d="ICON_MAP[editIcon]" fill="currentColor" /></svg>
                <span v-else class="icon-field-placeholder">pick…</span>
              </button>
              <label class="modal-label">Grid spacing (px)</label>
              <input
                v-model.number="editSpacing"
                class="modal-input modal-input--short"
                type="number"
                min="0"
                max="64"
              />
              <label class="modal-label">Card height (px)</label>
              <input
                v-model.number="editCardHeight"
                class="modal-input modal-input--short"
                type="number"
                min="40"
                max="600"
              />
              <label class="modal-label">Card width (px)</label>
              <input
                v-model.number="editCardWidth"
                class="modal-input modal-input--short"
                type="number"
                min="40"
                max="800"
              />
            </div>
            <p v-if="editError" class="modal-error">{{ editError }}</p>
            <div class="modal-actions">
              <button type="button" class="modal-delete" @click="deletePage">Remove</button>
              <div class="modal-actions-right">
                <button type="button" class="modal-cancel" @click="cancelEditing">Cancel</button>
                <button type="submit" class="modal-confirm" :disabled="!editName.trim()">OK</button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <div v-if="adding" class="modal-backdrop" @click.self="cancelAdding">
        <div class="modal">
          <h2 class="modal-title">New Page</h2>
          <form @submit.prevent="submitPage">
            <div class="modal-fields">
              <div class="modal-row">
                <label class="modal-label">Order</label>
                <input v-model.number="newOrder" class="modal-input modal-input--short" type="number" min="0" />
              </div>
              <label class="modal-label">Name</label>
              <input
                ref="nameInput"
                v-model="newName"
                class="modal-input"
                placeholder="Page name"
                maxlength="40"
              />
              <label class="modal-label">Icon</label>
              <button type="button" class="icon-field" @click="newIconPickerOpen = true">
                <svg v-if="newIcon && ICON_MAP[newIcon]" viewBox="0 0 24 24" width="20" height="20"><path :d="ICON_MAP[newIcon]" fill="currentColor" /></svg>
                <span v-else class="icon-field-placeholder">pick…</span>
              </button>
              <label class="modal-label">Grid spacing (px)</label>
              <input v-model.number="newSpacing" class="modal-input modal-input--short" type="number" min="0" max="64" />
              <label class="modal-label">Card height (px)</label>
              <input v-model.number="newCardHeight" class="modal-input modal-input--short" type="number" min="40" max="600" />
              <label class="modal-label">Card width (px)</label>
              <input v-model.number="newCardWidth" class="modal-input modal-input--short" type="number" min="40" max="800" />
            </div>
            <p v-if="addError" class="modal-error">{{ addError }}</p>
            <div class="modal-actions">
              <span></span>
              <div class="modal-actions-right">
                <button type="button" class="modal-cancel" @click="cancelAdding">Cancel</button>
                <button type="submit" class="modal-confirm" :disabled="!newName.trim()">Create</button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <div v-if="mqttSettingsOpen" class="modal-backdrop" @click.self="mqttSettingsOpen = false">
        <div class="modal">
          <h2 class="modal-title">MQTT Settings</h2>
          <form @submit.prevent="submitMqttSettings">
            <div class="modal-fields">
              <label class="modal-label">Broker URL</label>
              <input v-model="mqttFields.broker_url" class="modal-input" placeholder="mqtt://localhost:1883" />
              <label class="modal-label">Client ID</label>
              <input v-model="mqttFields.client_id" class="modal-input" placeholder="mqtt-layout" />
              <label class="modal-label">Username</label>
              <input v-model="mqttFields.username" class="modal-input" placeholder="(optional)" />
              <label class="modal-label">Password</label>
              <div class="password-wrapper">
                <input v-model="mqttFields.password" class="modal-input" :type="showPassword ? 'text' : 'password'" placeholder="(optional)" />
                <button type="button" class="password-toggle" @click="showPassword = !showPassword" :title="showPassword ? 'Hide password' : 'Show password'">
                  {{ showPassword ? '🙈' : '👁' }}
                </button>
              </div>
            </div>
            <p v-if="mqttError" class="modal-error">{{ mqttError }}</p>
            <div class="modal-actions">
              <span></span>
              <div class="modal-actions-right">
                <button type="button" class="modal-cancel" @click="mqttSettingsOpen = false">Cancel</button>
                <button type="submit" class="modal-confirm">Save</button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <PageIconPicker
        v-if="iconPickerOpen"
        :model-value="editIcon"
        @update:model-value="editIcon = $event"
        @cancel="iconPickerOpen = false"
      />
      <PageIconPicker
        v-if="newIconPickerOpen"
        :model-value="newIcon"
        @update:model-value="newIcon = $event"
        @cancel="newIconPickerOpen = false"
      />
    </Teleport>
  </nav>
</template>

<script setup>
import { computed, ref, nextTick, inject } from 'vue';
import { mdiChevronLeft, mdiChevronRight, mdiHomeAssistant } from '@mdi/js';
import { useMqttStore } from '../../stores/mqttStore.js';
import PageIconPicker from '../dialogs/PageIconPicker.vue';
import { ICON_MAP, ICON_VIEWBOXES } from '../../utils/pageIcons.js';

const collapsed = ref(false);

function reloadPage() { window.location.reload(); }

const addPage = inject('addPage');
const removePage = inject('remove_page');

const props = defineProps({
  pages: { type: Array, default: () => [] },
});

const editing = inject('editing');

const sortedPages = computed(() =>
  [...props.pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
);


const editingPage = ref(null);
const editName = ref('');
const editIcon = ref('');
const iconPickerOpen = ref(false);
const editSpacing = ref(16);
const editCardHeight = ref(120);
const editCardWidth = ref(150);
const editOrder = ref(0);
const editMobile = ref(true);
const editError = ref('');
const renameInput = ref(null);

function startEditing(page) {
  editingPage.value = page;
  editName.value = page.name;
  editIcon.value = page.icon ?? '';
  iconPickerOpen.value = false;
  editSpacing.value = page.grid_spacing ?? 16;
  editCardHeight.value = page.card_height ?? 120;
  editCardWidth.value = page.card_width ?? 150;
  editOrder.value = page.order ?? 0;
  editMobile.value = page.mobile !== false;
  editError.value = '';
  nextTick(() => renameInput.value?.focus());
}

function cancelEditing() {
  editingPage.value = null;
  editName.value = '';
  editError.value = '';
}

async function deletePage() {
  const slug = editingPage.value.path.replace(/^\//, '');
  try {
    const res = await fetch(`/api/pages/${slug}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      editError.value = data.error ?? 'Failed to delete page';
      return;
    }
    const page = editingPage.value;
    cancelEditing();
    removePage(page);
  } catch {
    editError.value = 'Network error';
  }
}

async function submitRename() {
  editError.value = '';
  const slug = editingPage.value.path.replace(/^\//, '');
  try {
    const res = await fetch(`/api/pages/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.value.trim(), icon: editIcon.value.trim(), grid_spacing: editSpacing.value, card_height: editCardHeight.value, card_width: editCardWidth.value, order: editOrder.value, mobile: editMobile.value }),
    });
    const data = await res.json();
    if (!res.ok) {
      editError.value = data.error ?? 'Failed to update page';
      return;
    }
    const oldPath = editingPage.value.path;
    editingPage.value.name = data.name;
    editingPage.value.path = data.path;
    editingPage.value.icon = data.icon ?? '';
    editingPage.value.grid_spacing = data.grid_spacing;
    editingPage.value.card_height = data.card_height;
    editingPage.value.card_width = data.card_width;
    editingPage.value.order = data.order;
    editingPage.value.mobile = data.mobile;
    cancelEditing();
    if (data.path !== oldPath) {
      window.location.href = data.path;
    }
  } catch {
    editError.value = 'Network error';
  }
}

const mqttStore = useMqttStore();
const status = computed(() => mqttStore.status);
const statusLabel = computed(() => {
  const map = { connected: 'Connected', connecting: 'Connecting…', disconnected: 'Disconnected' };
  return map[status.value] ?? status.value;
});

const adding = ref(false);
const newName = ref('');
const newIcon = ref('');
const newSpacing = ref(16);
const newCardHeight = ref(120);
const newCardWidth = ref(150);
const newOrder = ref(0);
const newIconPickerOpen = ref(false);
const addError = ref('');
const nameInput = ref(null);

function startAdding() {
  adding.value = true;
  addError.value = '';
  newName.value = '';
  newIcon.value = '';
  newSpacing.value = 16;
  newCardHeight.value = 120;
  newCardWidth.value = 150;
  newOrder.value = props.pages.length;
  newIconPickerOpen.value = false;
  nextTick(() => nameInput.value?.focus());
}

function cancelAdding() {
  adding.value = false;
  newName.value = '';
  addError.value = '';
}

// ── MQTT settings ─────────────────────────────────────────────────────────────
const mqttSettingsOpen = ref(false);
const mqttError = ref('');
const mqttFields = ref({});
const showPassword = ref(false);

async function openMqttSettings() {
  mqttError.value = '';
  showPassword.value = false;
  try {
    const res = await fetch('/api/mqtt');
    mqttFields.value = await res.json();
  } catch {
    mqttFields.value = {};
  }
  mqttSettingsOpen.value = true;
}

async function submitMqttSettings() {
  mqttError.value = '';
  try {
    const res = await fetch('/api/mqtt', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mqttFields.value),
    });
    if (!res.ok) {
      const data = await res.json();
      mqttError.value = data.error ?? 'Failed to save settings';
      return;
    }
    mqttSettingsOpen.value = false;
  } catch {
    mqttError.value = 'Network error';
  }
}

async function submitPage() {
  addError.value = '';
  try {
    const res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.value.trim(), icon: newIcon.value, grid_spacing: newSpacing.value, card_height: newCardHeight.value, card_width: newCardWidth.value, order: newOrder.value }),
    });
    if (!res.ok) {
      const data = await res.json();
      addError.value = data.error ?? 'Failed to create page';
      return;
    }
    const config = await res.json();
    cancelAdding();
    addPage(config);
  } catch {
    addError.value = 'Network error';
  }
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: width 0.2s ease;
}

.sidebar--collapsed {
  width: 52px;
}

.sidebar-header {
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  overflow: hidden;
}

.collapse-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}

.collapse-btn:hover {
  color: var(--text-primary);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  overflow: hidden;
}

.sidebar--collapsed .sidebar-brand {
  display: none;
}

.mosquitto-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
}

.nav-list {
  list-style: none;
  padding: 0.5rem 0;
  flex: 1;
}

.nav-icon-svg {
  margin-right: 0.4rem;
  flex-shrink: 0;
  opacity: 0.75;
}

.nav-link {
  display: flex;
  align-items: center;
  padding: 0.6rem 1rem;
  color: var(--text-secondary);
  font-size: 1.05rem;
  border-left: 3px solid transparent;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  overflow: hidden;
  white-space: nowrap;
}

.sidebar--collapsed .nav-link {
  justify-content: center;
  padding: 0.6rem 0;
}

.sidebar--collapsed .nav-link-text {
  display: none;
}

.sidebar--collapsed .nav-icon-svg {
  margin-right: 0;
}

.nav-icon-fallback {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.75;
}

.nav-link:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

.nav-link--active {
  color: var(--accent-blue);
  border-left-color: var(--accent-blue);
  background: var(--bg-card);
}

.nav-item {
  display: flex;
  align-items: center;
}

.nav-item .nav-link {
  flex: 1;
}

.page-edit-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.85rem;
  padding: 0 0.75rem 0 0;
  cursor: pointer;
  transition: color 0.15s;
}

.page-edit-btn:hover {
  color: var(--accent-blue);
  opacity: 1;
}

.add-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.5rem;
  cursor: pointer;
  transition: color 0.15s;
}

.add-btn:hover {
  color: var(--accent-blue);
}

.footer-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  position: relative;
  top: -2px;
}

.edit-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.5rem;
  cursor: pointer;
  transition: color 0.15s;
}

.edit-btn:hover,
.edit-btn--active {
  color: var(--accent-blue);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.75rem;
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-fields {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.25rem;
}

.modal-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  grid-column: 1 / -1;
}

.modal-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.modal-checkbox {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
}

.modal-input {
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.95rem;
  padding: 0.55rem 0.75rem;
  font-family: inherit;
  outline: none;
}

.modal-input:focus {
  border-color: var(--accent-blue);
}

.modal-input--short {
  width: 80px;
}

.modal-error {
  font-size: 0.8rem;
  color: var(--accent-red);
  margin-top: -0.5rem;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.modal-actions-right {
  display: flex;
  gap: 0.75rem;
}

.modal-delete {
  border: 1px solid var(--accent-red);
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  background: transparent;
  color: var(--accent-red);
}

.modal-delete:hover {
  background: var(--accent-red);
  color: #fff;
}

.modal-cancel, .modal-confirm {
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
}

.modal-cancel {
  background: var(--bg-card);
  color: var(--text-secondary);
}

.modal-cancel:hover {
  background: var(--bg-card-hover);
}

.modal-confirm {
  background: var(--accent-blue);
  color: #fff;
}

.modal-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sidebar-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  overflow: hidden;
}

.sidebar--collapsed .sidebar-footer {
  justify-content: center;
  padding: 0.75rem 0;
}

.sidebar--collapsed .status-label,
.sidebar--collapsed .footer-actions {
  display: none;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  position: relative;
  top: -3px;
}
.status-dot--connected { background: var(--accent-green); }
.status-dot--connecting { background: var(--accent-yellow); }
.status-dot--disconnected { background: var(--accent-red); }

.status-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  cursor: pointer;
  position: relative;
  top: -3px;
  transition: color 0.15s;
}

.status-label:hover {
  color: var(--text-primary);
}

.password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-wrapper .modal-input {
  padding-right: 2.2rem;
}

.password-toggle {
  position: absolute;
  right: 0.4rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
  padding: 0;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.password-toggle:hover {
  opacity: 1;
}

.icon-field {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 34px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 1.2rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color 0.15s;
}

.icon-field:hover {
  border-color: var(--accent-blue);
}

.icon-field-placeholder {
  font-size: 0.75rem;
  color: var(--text-muted);
}

</style>
