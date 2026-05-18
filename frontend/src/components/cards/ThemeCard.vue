<template>
  <div class="card theme-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon">
        <path :d="mdiPalette" />
      </svg>
      {{ card.title || 'Themes' }}
    </div>

    <div v-if="!themes.length" class="empty-msg">No themes yet</div>
    <div v-else class="theme-list">
      <div v-for="t in themes" :key="t.id" class="theme-row">
        <span class="active-dot" :class="{ 'active-dot--on': activeThemeId === t.id }"></span>
        <span class="theme-name" :class="{ 'theme-name--active': activeThemeId === t.id }">{{ t.name }}</span>
        <button class="apply-btn" :class="{ 'apply-btn--active': activeThemeId === t.id }" @click="applyTheme(t)">Apply</button>
        <button v-if="editing" class="row-edit-btn" @click.stop="openEdit(t)">✎</button>
        <button v-if="editing" class="row-edit-btn row-edit-btn--del" @click.stop="deleteTheme(t)">✕</button>
      </div>
    </div>

    <!-- Theme editor dialog -->
    <Teleport to="body">
      <div v-if="form" class="dialog-backdrop" @click.self="cancelEdit">
        <div class="dialog" :style="{ background: dialogBg, borderColor: dialogBorder }">
          <h3 class="dialog-title">{{ form.isNew ? 'New Theme' : 'Edit Theme' }}</h3>

          <div class="editor-name-row">
            <label class="editor-label">Name</label>
            <input class="editor-input editor-input--flex" :class="{ 'editor-input--error': nameError }" type="text" v-model="form.name" placeholder="My Theme" @input="nameError = false" />
          </div>

          <div class="editor-section-title">Layout</div>
          <div class="editor-grid">
            <template v-for="v in layoutVars" :key="v.key">
              <label class="editor-label">{{ v.label }}</label>
              <input type="color" class="color-picker" :value="form.vars[v.key]" @input="liveSet(v.key, $event.target.value)" />
            </template>
          </div>

          <div class="editor-section-title">Text</div>
          <div class="editor-grid">
            <template v-for="v in textVars" :key="v.key">
              <label class="editor-label">{{ v.label }}</label>
              <input type="color" class="color-picker" :value="form.vars[v.key]" @input="liveSet(v.key, $event.target.value)" />
            </template>
          </div>

          <div class="editor-section-title">Accent</div>
          <div class="editor-grid">
            <template v-for="v in accentVars" :key="v.key">
              <label class="editor-label">{{ v.label }}</label>
              <input type="color" class="color-picker" :value="form.vars[v.key]" @input="liveSet(v.key, $event.target.value)" />
            </template>
          </div>

          <div class="editor-section-title">Typography</div>
          <div class="editor-grid">
            <label class="editor-label">Font</label>
            <select class="editor-input" v-model="form.vars['--font-family']" @change="liveSet('--font-family', form.vars['--font-family'])">
              <option v-for="f in fontOptions" :key="f.value" :value="f.value">{{ f.label }}</option>
            </select>
            <label class="editor-label">Size (px)</label>
            <div class="size-row">
              <input type="range" min="12" max="18" step="1" class="size-range"
                :value="parsePx(form.vars['--font-size'])"
                @input="liveSet('--font-size', $event.target.value + 'px')" />
              <span class="size-val">{{ form.vars['--font-size'] }}</span>
            </div>
          </div>

          <div class="dialog-actions">
            <span></span>
            <div class="dialog-actions-right">
              <button class="dialog-cancel" @click="cancelEdit">Cancel</button>
              <button class="dialog-confirm" @click="saveEdit">OK</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
export const icon = '🎨';
</script>

<script setup>
import { ref, onMounted, inject } from 'vue';
import { mdiPalette } from '@mdi/js';

const props = defineProps({ card: { type: Object, required: true } });
const editing = inject('editing', ref(false));

const themes       = ref([]);
const activeThemeId = ref(localStorage.getItem('active_theme_id') ? Number(localStorage.getItem('active_theme_id')) : null);
const form         = ref(null);
const nameError    = ref(false);
const dialogBg     = ref('#1a1f2e');
const dialogBorder = ref('#2d3452');

function snapshotDialogColors() {
  const s = getComputedStyle(document.documentElement);
  dialogBg.value     = s.getPropertyValue('--bg-surface').trim() || '#1a1f2e';
  dialogBorder.value = s.getPropertyValue('--border').trim()     || '#2d3452';
}

const DEFAULT_VARS = {
  '--bg-base':       '#0f1117',
  '--bg-surface':    '#1a1f2e',
  '--bg-card':       '#1e2336',
  '--bg-card-hover': '#252b40',
  '--border':        '#2d3452',
  '--text-primary':  '#e8eaf0',
  '--text-secondary':'#8892b0',
  '--text-muted':    '#4a5578',
  '--accent-blue':   '#4f8ef7',
  '--accent-green':  '#4ade80',
  '--accent-yellow': '#fbbf24',
  '--accent-red':    '#f87171',
  '--font-family':   'Inter, Segoe UI, system-ui, sans-serif',
  '--font-size':     '14px',
};

const swatchKeys = ['--bg-base', '--bg-card', '--accent-blue', '--text-primary'];

const layoutVars = [
  { key: '--bg-base',       label: 'Page bg'     },
  { key: '--bg-surface',    label: 'Sidebar bg'  },
  { key: '--bg-card',       label: 'Card bg'     },
  { key: '--bg-card-hover', label: 'Card hover'  },
  { key: '--border',        label: 'Border'      },
];
const textVars = [
  { key: '--text-primary',   label: 'Primary'   },
  { key: '--text-secondary', label: 'Secondary' },
  { key: '--text-muted',     label: 'Muted'     },
];
const accentVars = [
  { key: '--accent-blue',   label: 'Blue'   },
  { key: '--accent-green',  label: 'Green'  },
  { key: '--accent-yellow', label: 'Yellow' },
  { key: '--accent-red',    label: 'Red'    },
];

const fontOptions = [
  { label: 'Inter (default)',  value: 'Inter, Segoe UI, system-ui, sans-serif' },
  { label: 'Roboto',           value: 'Roboto, sans-serif' },
  { label: 'Open Sans',        value: '"Open Sans", sans-serif' },
  { label: 'Lato',             value: 'Lato, sans-serif' },
  { label: 'Nunito',           value: 'Nunito, sans-serif' },
  { label: 'Ubuntu',           value: 'Ubuntu, sans-serif' },
  { label: 'Helvetica',        value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Verdana',          value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet',        value: '"Trebuchet MS", sans-serif' },
  { label: 'Georgia (serif)',  value: 'Georgia, serif' },
  { label: 'System UI',        value: 'system-ui, sans-serif' },
  { label: 'SF Pro / Apple',   value: '-apple-system, BlinkMacSystemFont, sans-serif' },
  { label: 'Monospace',        value: 'ui-monospace, monospace' },
  { label: 'Courier New',      value: '"Courier New", monospace' },
];

function parsePx(val) { return parseInt(val) || 14; }

onMounted(async () => {
  try {
    const res = await fetch('/api/themes');
    if (res.ok) themes.value = await res.json();
  } catch { /* ignore */ }
});

async function save() {
  await fetch('/api/themes', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(themes.value),
  });
}

function applyTheme(t) {
  for (const [k, v] of Object.entries(t.vars))
    document.documentElement.style.setProperty(k, v);
  activeThemeId.value = t.id;
  localStorage.setItem('active_theme_id', t.id);
  localStorage.setItem('active_theme', JSON.stringify(t.vars));
}

// Live preview while editing
let preEditVars = null;
function liveSet(key, value) {
  form.value.vars[key] = value;
  document.documentElement.style.setProperty(key, value);
}

function openEdit(t) {
  snapshotDialogColors();
  preEditVars = { ...t.vars };
  form.value = { ...t, vars: { ...t.vars }, isNew: false };
}

function openAdd() {
  snapshotDialogColors();
  // Snapshot current root vars as starting point for new theme
  const currentVars = {};
  for (const key of Object.keys(DEFAULT_VARS)) {
    currentVars[key] = getComputedStyle(document.documentElement).getPropertyValue(key).trim() || DEFAULT_VARS[key];
  }
  preEditVars = null;
  form.value = { id: Date.now(), name: '', vars: currentVars, isNew: true };
}

function cancelEdit() {
  // Revert live preview if editing existing theme
  if (preEditVars) {
    for (const [k, v] of Object.entries(preEditVars))
      document.documentElement.style.setProperty(k, v);
  }
  form.value = null;
}

function saveEdit() {
  if (!form.value.name.trim()) { nameError.value = true; return; }
  const { isNew, ...theme } = form.value;
  if (isNew) {
    themes.value.push(theme);
  } else {
    const idx = themes.value.findIndex(t => t.id === theme.id);
    if (idx >= 0) themes.value[idx] = theme;
  }
  // If this was the active theme, update localStorage
  if (activeThemeId.value === theme.id) {
    localStorage.setItem('active_theme', JSON.stringify(theme.vars));
  }
  save();
  form.value = null;
}

async function deleteTheme(t) {
  themes.value = themes.value.filter(x => x.id !== t.id);
  if (activeThemeId.value === t.id) {
    activeThemeId.value = null;
    localStorage.removeItem('active_theme_id');
    localStorage.removeItem('active_theme');
  }
  await save();
}

defineExpose({ openAdd });
</script>

<style scoped>
.theme-card {
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
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: #9aa3bc;
}

.theme-list {
  flex: 1;
  overflow-y: auto;
  margin: 0 -0.65rem;
}

.theme-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.22rem 0.65rem;
  white-space: nowrap;
  overflow: hidden;
}
.theme-row:hover { background: var(--bg-card-hover); }

.active-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #444;
  transition: background 0.2s;
}
.active-dot--on { background: #4caf6e; box-shadow: 0 0 4px #4caf6e; }

.theme-name {
  flex: 1;
  font-size: 0.8rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}
.theme-name--active { color: var(--text-primary); font-weight: 500; }

.apply-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  cursor: pointer;
  flex-shrink: 0;
  font-family: inherit;
}
.apply-btn:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
.apply-btn--active { border-color: #4caf6e; color: #4caf6e; }

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
.row-edit-btn--del:hover { color: var(--accent-red); }

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
  padding: 2rem 0;
}

.dialog {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.5rem;
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dialog-title { font-size: 1rem; font-weight: 600; color: var(--text-primary); }

.editor-section-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: #6b7694;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.25rem;
}

.editor-name-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.editor-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.4rem 0.75rem;
  align-items: center;
}

.editor-label {
  font-size: 0.8rem;
  color: #9aa3bc;
  white-space: nowrap;
}

.editor-input {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.875rem;
  padding: 0.3rem 0.5rem;
  font-family: inherit;
  outline: none;
  width: 100%;
}
.editor-input--flex { flex: 1; }
.editor-input:focus { border-color: var(--accent-blue); }
.editor-input--error { border-color: var(--accent-red) !important; }

.color-picker {
  width: 36px;
  height: 28px;
  border: 1px solid #3d4870;
  border-radius: 4px;
  background: none;
  padding: 1px;
  cursor: pointer;
}

.size-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.size-range { flex: 1; cursor: pointer; accent-color: var(--accent-blue); }
.size-val { font-size: 0.75rem; color: #9aa3bc; min-width: 28px; }

.dialog-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem; }
.dialog-actions-right { display: flex; gap: 0.5rem; }

.dialog-cancel, .dialog-confirm {
  border: none; border-radius: 6px;
  font-size: 0.875rem; font-family: inherit; padding: 0.45rem 1rem; cursor: pointer;
}
.dialog-cancel { background: #2a3150; color: #9aa3bc; border: 1px solid #3d4870; }
.dialog-cancel:hover { background: #313858; }
.dialog-confirm { background: var(--accent-blue); color: #fff; }
</style>
