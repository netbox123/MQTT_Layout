<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">{{ isNew ? 'New Music Assistant Card' : 'Edit Music Assistant Card' }}</h2>
        <div class="fields">
          <div class="mobile-row">
            <label class="field-label">Mobile</label>
            <label class="field-checkbox">
              <input type="checkbox" :checked="fields.mobile_show" @change="fields.mobile_show = $event.target.checked" />
              <span>{{ fields.mobile_show ? 'Yes' : 'No' }}</span>
            </label>
            <label class="field-label">Order</label>
            <input class="field-input field-input--short" type="number" v-model.number="fields.mobile_order" />
          </div>

          <label class="field-label">ma url</label>
          <input class="field-input" type="text" v-model="fields.ma_url" />

          <label class="field-label">ma token</label>
          <input class="field-input" type="text" v-model="fields.ma_token" />

          <label class="field-label">player</label>
          <select class="field-input" v-model="fields.player_id">
            <option value="">Auto</option>
            <option v-for="p in visiblePlayers" :key="p.player_id" :value="p.player_id">
              {{ p.display_name || p.name }}
            </option>
          </select>

          <label class="field-label">volume</label>
          <div class="vol-row">
            <svg viewBox="0 0 24 24" fill="currentColor" class="vol-icon"><path :d="volumeIcon" /></svg>
            <input type="range" min="0" max="100" step="1"
              :value="localVolume"
              :style="{ '--vol': localVolume + '%' }"
              @input="onVolume" class="field-input vol-slider" />
            <span class="vol-val">{{ localVolume }}%</span>
          </div>

          <label class="field-label">shuffle</label>
          <div class="toggle-row">
            <button class="toggle-btn" :class="{ active: activeQueue?.shuffle_enabled }"
              @click="toggleShuffle">
              <svg viewBox="0 0 24 24" fill="currentColor" class="toggle-icon"><path :d="mdiShuffle" /></svg>
              {{ activeQueue?.shuffle_enabled ? 'On' : 'Off' }}
            </button>
          </div>

          <label class="field-label">repeat</label>
          <div class="toggle-row">
            <button class="toggle-btn" :class="{ active: activeQueue?.repeat_mode !== 'off' && activeQueue?.repeat_mode != null }"
              @click="cycleRepeat">
              <svg viewBox="0 0 24 24" fill="currentColor" class="toggle-icon">
                <path :d="activeQueue?.repeat_mode === 'one' ? mdiRepeatOnce : mdiRepeat" />
              </svg>
              {{ repeatLabel }}
            </button>
          </div>

        </div>

        <div class="modal-actions">
          <button v-if="!isNew" class="modal-delete" @click="$emit('delete')">Delete</button>
          <span v-else></span>
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
import { reactive, ref, computed, watch } from 'vue';
import { useMusicAssistant } from '../../composables/useMusicAssistant.js';
import { mdiVolumeHigh, mdiVolumeMedium, mdiVolumeLow, mdiVolumeOff, mdiShuffle, mdiRepeat, mdiRepeatOnce } from '@mdi/js';

const props = defineProps({
  card: { type: Object, required: true },
  isNew: { type: Boolean, default: false },
});
const emit = defineEmits(['save', 'cancel', 'delete']);

const fields = reactive({
  ma_url:       props.card.ma_url    || 'http://192.168.0.20:8095',
  ma_token:     props.card.ma_token  || '',
  player_id:    props.card.player_id || '',
  mobile_show:  props.card.mobile_show  !== false,
  mobile_order: props.card.mobile_order ?? 0,
});

const ma = useMusicAssistant(fields.ma_url, fields.ma_token);

const visiblePlayers = computed(() =>
  ma.players.value.filter(p => p.enabled)
);

const activePlayer = computed(() =>
  ma.players.value.find(p => p.player_id === fields.player_id) ?? visiblePlayers.value[0]
);

const activeQueue = computed(() => ma.queues.value[activePlayer.value?.player_id]);

const volumeIcon = computed(() => {
  const v = activePlayer.value?.volume_level ?? 0;
  if (v === 0) return mdiVolumeOff;
  if (v < 33)  return mdiVolumeLow;
  if (v < 66)  return mdiVolumeMedium;
  return mdiVolumeHigh;
});

const localVolume = ref(activePlayer.value?.volume_level ?? 0);
watch(() => activePlayer.value?.volume_level, v => { if (v != null) localVolume.value = v; });

let volTimer = null;
function onVolume(e) {
  localVolume.value = Number(e.target.value);
  clearTimeout(volTimer);
  const id = activePlayer.value?.player_id;
  if (id) volTimer = setTimeout(() => ma.setVolume(id, localVolume.value), 120);
}

function toggleShuffle() {
  const id = activePlayer.value?.player_id;
  if (id) ma.setShuffle(id, !activeQueue.value?.shuffle_enabled);
}

const repeatModes = ['off', 'all', 'one'];
const repeatLabel = computed(() => {
  const m = activeQueue.value?.repeat_mode;
  if (m === 'all') return 'All';
  if (m === 'one') return 'One';
  return 'Off';
});

function cycleRepeat() {
  const id = activePlayer.value?.player_id;
  if (!id) return;
  const cur = activeQueue.value?.repeat_mode ?? 'off';
  const next = repeatModes[(repeatModes.indexOf(cur) + 1) % repeatModes.length];
  ma.setRepeat(id, next);
}

function save() {
  const out = {
    type:         props.card.type,
    ma_url:       fields.ma_url,
    ma_token:     fields.ma_token,
    position:     props.card.position,
    mobile_show:  fields.mobile_show,
    mobile_order: fields.mobile_order,
  };
  if (fields.player_id) out.player_id = fields.player_id;
  emit('save', out);
}
</script>

<style scoped>
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
  width: 420px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.fields {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
  align-items: center;
  overflow-y: auto;
}

.mobile-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  grid-column: 1 / -1;
}

.field-input--short {
  width: 8ch !important;
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

.vol-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.vol-icon { width: 16px; height: 16px; flex-shrink: 0; color: #9aa3bc; }
.vol-slider {
  -webkit-appearance: none;
  appearance: none;
  padding: 0;
  height: 3px;
  cursor: pointer;
  border: none;
  border-radius: 2px;
  background: linear-gradient(to right, #fff var(--vol, 0%), rgba(255,255,255,0.2) var(--vol, 0%));
}
.vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
}
.vol-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  border: none;
  cursor: pointer;
}
.vol-val { font-size: 0.75rem; color: #9aa3bc; min-width: 32px; text-align: right; }

.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
}

.toggle-row { display: flex; align-items: center; }

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.75rem;
  border: 1px solid #3d4870;
  border-radius: 6px;
  background: #2a3150;
  color: #9aa3bc;
  font-size: 0.8rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.toggle-btn.active {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: #fff;
}
.toggle-btn:hover:not(.active) { background: #313858; }
.toggle-icon { width: 15px; height: 15px; flex-shrink: 0; }

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.25rem;
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
}
.modal-delete:hover { background: var(--accent-red); color: #fff; }

.modal-cancel, .modal-confirm {
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
}
.modal-cancel { background: #2a3150; color: #9aa3bc; border: 1px solid #3d4870; }
.modal-cancel:hover { background: #313858; }
.modal-confirm { background: var(--accent-blue); color: #fff; }
</style>
