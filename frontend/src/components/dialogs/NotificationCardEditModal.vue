<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">

        <!-- Header row -->
        <div class="modal-header">
          <h2 class="modal-title">
            {{ view === 'events' ? 'Notification Events' : (isNew ? 'New Notification Card' : 'Edit Notifications') }}
          </h2>
          <button v-if="view === 'notifications'" class="header-btn" type="button" @click="openEvents">Events</button>
          <button v-else class="header-btn" type="button" @click="view = 'notifications'">← Back</button>
        </div>

        <!-- ── NOTIFICATIONS VIEW ── -->
        <template v-if="view === 'notifications'">
          <div class="mobile-row">
            <label class="size-label">Mobile</label>
            <label class="field-checkbox">
              <input type="checkbox" v-model="local.mobile_show" />
              <span>{{ local.mobile_show ? 'Yes' : 'No' }}</span>
            </label>
            <label class="size-label">Order</label>
            <input class="size-input" type="number" min="0" v-model.number="local.mobile_order" />
          </div>

          <div class="fields">
            <label class="field-label">MA sound URL</label>
            <input class="field-input" v-model="local.announcement_base_url" placeholder="e.g. http://192.168.0.20:3000" />
          </div>

          <!-- Notification rule list -->
          <div class="item-grid">
            <button
              v-for="(item, idx) in local.items"
              :key="idx"
              class="cell"
              :class="{ 'cell--active': selectedIdx === idx }"
              type="button"
              @click="selectedIdx = idx"
            >
              <svg v-if="item.icon && ICON_MAP[item.icon]" viewBox="0 0 24 24" width="16" height="16">
                <path :d="ICON_MAP[item.icon]" fill="currentColor" />
              </svg>
              <span v-else class="cell-empty-icon">🔔</span>
              <span class="cell-label">{{ item.title || '—' }}</span>
              <span class="cell-sub">{{ item.trigger_event || '' }}</span>
              <svg class="cell-fire" :class="{ 'cell-fire--firing': firing === idx }" viewBox="0 0 24 24"
                @click.stop="fireItem(item, idx)">
                <path :d="mdiFlash" fill="currentColor" />
              </svg>
            </button>
            <button class="cell cell--add" type="button" @click="addItem">
              <span class="cell-plus">+</span>
              <span class="cell-label">Add notification</span>
            </button>
          </div>

          <!-- Fields for selected notification -->
          <template v-if="selectedItem">
            <div class="fields">
              <label class="field-label">title</label>
              <input class="field-input" v-model="selectedItem.title" placeholder="e.g. Motion detected" />

              <label class="field-label">notification text</label>
              <input class="field-input" v-model="selectedItem.notification_text" placeholder="e.g. Front door motion sensor triggered" />

              <label class="field-label">trigger event</label>
              <input class="field-input" v-model="selectedItem.trigger_event" placeholder="MQTT topic" />

              <label class="field-label">icon</label>
              <button class="icon-field" type="button" @click="pickerOpen = true">
                <svg v-if="selectedItem.icon && ICON_MAP[selectedItem.icon]" viewBox="0 0 24 24" width="18" height="18">
                  <path :d="ICON_MAP[selectedItem.icon]" fill="currentColor" />
                </svg>
                <span class="icon-field-name">{{ selectedItem.icon || 'Choose icon…' }}</span>
              </button>

              <label class="field-label">alert sound</label>
              <select class="field-input" v-model="selectedItem.sound1">
                <option value="">— none —</option>
                <option v-for="s in sounds.alert_sounds" :key="s" :value="s">{{ s }}</option>
              </select>

              <label class="field-label">speech sound</label>
              <select class="field-input" v-model="selectedItem.sound2">
                <option value="">— none —</option>
                <option v-for="s in sounds.speech_sounds" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>

            <div class="item-btns">
              <button class="remove-item-btn" type="button" @click="removeSelected">Remove</button>
              <button class="save-item-btn" type="button" @click="selectedIdx = null">Done</button>
            </div>
          </template>

          <div v-else-if="local.items.length" class="no-selection">Click a row to edit</div>

          <div class="modal-actions">
            <button v-if="!isNew" class="modal-delete" @click="$emit('delete')">Delete</button>
            <span v-else></span>
            <div class="modal-actions-right">
              <button class="modal-cancel" @click="$emit('cancel')">Close</button>
              <button class="modal-confirm" @click="apply">OK</button>
            </div>
          </div>
        </template>

        <!-- ── EVENTS VIEW ── -->
        <template v-else>
          <div class="item-grid">
            <button
              v-for="(ev, idx) in events"
              :key="ev.id ?? idx"
              class="cell"
              :class="{ 'cell--active': selectedEvIdx === idx }"
              type="button"
              @click="selectedEvIdx = idx"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" style="flex-shrink:0">
                <path :d="mdiFlash" fill="currentColor" />
              </svg>
              <span class="cell-label">{{ ev.title || '—' }}</span>
              <span class="cell-sub">{{ ev.mqtt_topic || '' }}</span>
              <span class="cell-cond">{{ ev.condition || '' }} {{ ev.value ?? '' }}</span>
            </button>
            <button class="cell cell--add" type="button" @click="addEvent">
              <span class="cell-plus">+</span>
              <span class="cell-label">Add event</span>
            </button>
          </div>

          <!-- Fields for selected event -->
          <template v-if="selectedEvent">
            <div class="fields">
              <label class="field-label">title</label>
              <input class="field-input" v-model="selectedEvent.title" placeholder="e.g. High temperature" />

              <label class="field-label">mqtt topic</label>
              <input class="field-input" v-model="selectedEvent.mqtt_topic" placeholder="e.g. home/sensor/temp" />

              <label class="field-label">condition</label>
              <select class="field-input" v-model="selectedEvent.condition">
                <option value=">">&gt; (greater than)</option>
                <option value="<">&lt; (less than)</option>
                <option value="=">= (equals)</option>
              </select>

              <label class="field-label">value</label>
              <input class="field-input"
                :type="selectedEvent.condition === '=' ? 'text' : 'number'"
                v-model="selectedEvent.value"
                :placeholder="selectedEvent.condition === '=' ? 'e.g. ON' : 'e.g. 25'"
              />

              <label class="field-label">notification</label>
              <select class="field-input" v-model="selectedEvent.notification_title">
                <option value="">— none —</option>
                <option v-for="n in local.items" :key="n.title" :value="n.title">{{ n.title || '—' }}</option>
              </select>
            </div>

            <div class="item-btns">
              <button class="remove-item-btn" type="button" @click="removeEvent">Remove</button>
              <button class="save-item-btn" type="button" @click="saveEvent">Save</button>
            </div>
          </template>

          <div v-else-if="events.length" class="no-selection">Click a row to edit</div>
        </template>

      </div>
    </div>

    <PageIconPicker
      v-if="pickerOpen && selectedItem"
      :modelValue="selectedItem.icon ?? ''"
      @update:modelValue="val => { selectedItem.icon = val; pickerOpen = false; }"
      @cancel="pickerOpen = false"
    />
  </Teleport>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import PageIconPicker from './PageIconPicker.vue';
import { ICON_MAP } from '../../utils/pageIcons.js';
import { mdiFlash } from '@mdi/js';

const props = defineProps({
  card:  { type: Object,  required: true },
  isNew: { type: Boolean, default: false },
});

const emit = defineEmits(['save', 'apply', 'cancel', 'delete']);

const local = reactive({
  ...props.card,
  mobile_show:  props.card.mobile_show !== false,
  mobile_order: props.card.mobile_order ?? 0,
  position:     { ...props.card.position },
  items:        (props.card.items ?? []).map(i => ({ ...i })),
});

const view         = ref('notifications');
const selectedIdx  = ref(null);
const pickerOpen   = ref(false);
const sounds       = reactive({ alert_sounds: [], speech_sounds: [] });

// Events state
const events       = ref([]);
const selectedEvIdx = ref(null);

onMounted(async () => {
  try {
    const res = await fetch('/api/sounds');
    const data = await res.json();
    sounds.alert_sounds  = data.alert_sounds  ?? [];
    sounds.speech_sounds = data.speech_sounds ?? [];
  } catch { /* leave empty */ }
});

async function openEvents() {
  view.value = 'events';
  selectedEvIdx.value = null;
  try {
    const res = await fetch('/api/notification_events');
    events.value = await res.json();
  } catch { events.value = []; }
}

const selectedItem = computed(() =>
  selectedIdx.value !== null ? local.items[selectedIdx.value] ?? null : null
);

const selectedEvent = computed(() =>
  selectedEvIdx.value !== null ? events.value[selectedEvIdx.value] ?? null : null
);

const firing = ref(null);

async function fireItem(item, idx) {
  firing.value = idx;
  try {
    await fetch('/api/notifications', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:   item.title,
        message: item.notification_text,
        level:   'info',
        icon:    item.icon   || '',
        sound1:  item.sound1 || '',
        sound2:  item.sound2 || '',
      }),
    });
  } catch { /* ignore */ }
  firing.value = null;
}

function addItem() {
  local.items.push({ title: '', notification_text: '', trigger_event: '', icon: '', sound1: '', sound2: '' });
  selectedIdx.value = local.items.length - 1;
}

function removeSelected() {
  local.items.splice(selectedIdx.value, 1);
  selectedIdx.value = null;
}

function addEvent() {
  events.value.push({ title: '', mqtt_topic: '', condition: '>', value: 0 });
  selectedEvIdx.value = events.value.length - 1;
}

async function saveEvent() {
  const ev = selectedEvent.value;
  if (!ev) return;
  try {
    if (ev.id) {
      await fetch(`/api/notification_events/${ev.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(ev),
      });
    } else {
      const res  = await fetch('/api/notification_events', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(ev),
      });
      const saved = await res.json();
      events.value[selectedEvIdx.value] = saved;
    }
  } catch { /* ignore */ }
  selectedEvIdx.value = null;
}

async function removeEvent() {
  const ev = selectedEvent.value;
  if (!ev) return;
  if (ev.id) {
    try {
      await fetch(`/api/notification_events/${ev.id}`, { method: 'DELETE' });
    } catch { /* ignore */ }
  }
  events.value.splice(selectedEvIdx.value, 1);
  selectedEvIdx.value = null;
}

function buildPayload() {
  return {
    ...local,
    mobile_show:  local.mobile_show,
    mobile_order: local.mobile_order,
    position:     { ...local.position },
    items: local.items.map(i => ({
      title:             i.title,
      notification_text: i.notification_text,
      trigger_event:     i.trigger_event,
      icon:              i.icon,
      sound1:            i.sound1,
      sound2:            i.sound2,
    })),
  };
}

function apply() {
  selectedIdx.value = null;
  emit('apply', buildPayload());
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
  width: 400px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-btn {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: #9aa3bc;
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  white-space: nowrap;
}
.header-btn:hover { background: #313858; color: var(--text-primary); }

.mobile-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
}

.size-label {
  font-size: 0.8rem;
  color: #9aa3bc;
}

.size-input {
  width: 56px;
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.875rem;
  padding: 0.3rem 0.5rem;
  font-family: inherit;
  outline: none;
}
.size-input:focus { border-color: var(--accent-blue); }

/* Item grid */
.item-grid {
  display: grid;
  grid-template-columns: 1fr;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.cell {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  height: 40px;
  background: var(--bg-card);
  border: 0;
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  font-family: inherit;
  cursor: pointer;
  padding: 0 0.75rem;
  transition: background 0.15s, color 0.15s;
}
.cell:last-child { border-bottom: none; }
.cell:hover, .cell--active { background: var(--bg-card-hover); }
.cell--active { color: var(--text-primary); outline: 2px solid var(--accent-blue); outline-offset: -2px; }
.cell--add { color: #9aa3bc; }

.cell-plus  { font-size: 1rem; }
.cell-empty-icon { font-size: 0.9rem; }

.cell-label {
  font-size: 0.875rem;
  color: #9aa3bc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.cell-sub {
  font-size: 0.7rem;
  color: #6b7499;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}

.cell-cond {
  font-size: 0.7rem;
  color: #6b7499;
  white-space: nowrap;
  flex-shrink: 0;
}

.cell-fire {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: #6b7499;
  margin-left: auto;
  border-radius: 3px;
  padding: 1px;
  transition: color 0.15s;
}
.cell-fire:hover { color: #f59e0b; }
.cell-fire--firing { color: #f59e0b; }

/* Fields */
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
}
.field-input:focus { border-color: var(--accent-blue); }

select.field-input { cursor: pointer; }

.icon-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.875rem;
  padding: 0.35rem 0.6rem;
  font-family: inherit;
  cursor: pointer;
  width: 100%;
  text-align: left;
}
.icon-field:hover { border-color: var(--accent-blue); }
.icon-field-name { color: #9aa3bc; }

.item-btns {
  display: flex;
  gap: 0.5rem;
}

.remove-item-btn {
  background: none;
  border: 1px solid var(--accent-red);
  border-radius: 5px;
  color: var(--accent-red);
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
}
.remove-item-btn:hover { background: var(--accent-red); color: #fff; }

.save-item-btn {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: #9aa3bc;
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
}
.save-item-btn:hover { background: #313858; }

.no-selection {
  font-size: 0.85rem;
  color: #9aa3bc;
  text-align: center;
  padding: 0.5rem 0;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.25rem;
}
.modal-actions-right { display: flex; gap: 0.5rem; }

.modal-delete {
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  background: transparent;
  color: var(--accent-red);
  border: 1px solid var(--accent-red);
  cursor: pointer;
}
.modal-delete:hover { background: var(--accent-red); color: #fff; }

.modal-cancel, .modal-confirm {
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
</style>
