<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">{{ isNew ? 'New Grid Card' : 'Edit Grid Card' }}</h2>

        <div class="size-row">
          <label class="size-label">H</label>
          <input class="size-input" type="number" min="1" :value="local.rows"
            @input="local.rows = Math.max(1, parseInt($event.target.value) || 1)" />
          <label class="size-label">W</label>
          <input class="size-input" type="number" min="1" :value="local.cols"
            @input="local.cols = Math.max(1, parseInt($event.target.value) || 1)" />
        </div>

        <div class="mobile-row">
          <label class="size-label">Mobile</label>
          <label class="field-checkbox">
            <input type="checkbox" v-model="local.mobile_show" />
            <span>{{ local.mobile_show ? 'Yes' : 'No' }}</span>
          </label>
          <label class="size-label">Order</label>
          <input class="size-input" type="number" min="0" v-model.number="local.mobile_order" />
        </div>

        <!-- Visual grid matching card dimensions -->
        <div
          class="item-grid"
          :style="{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }"
        >
          <button
            v-for="({ col, row }) in cells"
            :key="`${col}-${row}`"
            class="cell"
            :class="{ 'cell--active': selectedCol === col && selectedRow === row, 'cell--filled': !!getItem(col, row) }"
            type="button"
            @click="selectCell(col, row)"
          >
            <template v-if="getItem(col, row)">
              <svg v-if="getItem(col, row).icon && ICON_MAP[getItem(col, row).icon]" viewBox="0 0 24 24" width="20" height="20">
                <path :d="ICON_MAP[getItem(col, row).icon]" fill="currentColor" />
              </svg>
              <span v-else class="cell-empty-icon">·</span>
              <span class="cell-label">{{ getItem(col, row).title || '—' }}</span>
            </template>
            <span v-else class="cell-plus">+</span>
          </button>
        </div>

        <!-- Fields for selected cell -->
        <template v-if="selectedItem">
          <div class="fields">
            <label class="field-label">type</label>
            <select class="field-select" v-model="selectedItem.type">
              <option value="sensor">Sensor</option>
              <option value="gauge">Gauge</option>
              <option value="switch">Switch</option>
              <option value="indicator">Indicator</option>
            </select>

            <template v-if="selectedItem.type !== 'gauge' && selectedItem.type !== 'sensor'">
              <label class="field-label">icon</label>
              <button class="icon-field" type="button" @click="pickerOpen = true">
                <svg v-if="selectedItem.icon && ICON_MAP[selectedItem.icon]" viewBox="0 0 24 24" width="18" height="18">
                  <path :d="ICON_MAP[selectedItem.icon]" fill="currentColor" />
                </svg>
                <span class="icon-field-name">{{ selectedItem.icon || 'Choose icon…' }}</span>
              </button>
            </template>

            <label class="field-label">title</label>
            <input class="field-input" v-model="selectedItem.title" />

            <label class="field-label">mqtt topic</label>
            <input class="field-input" v-model="selectedItem.mqtt_topic" />

            <template v-if="selectedItem.type === 'switch'">
              <label class="field-label">command topic</label>
              <input class="field-input" v-model="selectedItem.command_topic" />
              <label class="field-label">ha entity id</label>
              <input class="field-input" v-model="selectedItem.ha_entity_id" />
            </template>

            <template v-if="selectedItem.type === 'sensor'">
              <label class="field-label">unit</label>
              <input class="field-input" v-model="selectedItem.unit" />
              <label class="field-label">round</label>
              <input class="field-input" type="number" min="0" v-model.number="selectedItem.round" />
            </template>

            <template v-if="selectedItem.type === 'gauge'">
              <label class="field-label">min</label>
              <input class="field-input" type="number" v-model.number="selectedItem.min" />
              <label class="field-label">max</label>
              <input class="field-input" type="number" v-model.number="selectedItem.max" />
              <label class="field-label">unit</label>
              <input class="field-input" v-model="selectedItem.unit" />
            </template>
          </div>

          <div class="item-btns">
            <button class="remove-item-btn" type="button" @click="removeSelected">Remove item</button>
            <button class="save-item-btn" type="button" @click="selectedCol = null; selectedRow = null">Save item</button>
          </div>
        </template>

        <div v-else-if="!isNew" class="no-selection">Click a cell to edit</div>

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

    <PageIconPicker
      v-if="pickerOpen && selectedItem"
      :modelValue="selectedItem.icon ?? ''"
      @update:modelValue="val => { selectedItem.icon = val; pickerOpen = false; }"
      @cancel="pickerOpen = false"
    />
  </Teleport>
</template>

<script setup>
import { reactive, ref, computed } from 'vue';
import PageIconPicker from './PageIconPicker.vue';
import { ICON_MAP } from '../../utils/pageIcons.js';

const props = defineProps({
  card: { type: Object, required: true },
  isNew: { type: Boolean, default: false },
});

const emit = defineEmits(['save', 'cancel', 'delete']);

function cloneCard(card) {
  const w = card.cols ?? card.position?.w ?? 2;
  return {
    ...card,
    cols: card.cols ?? card.position?.w ?? 2,
    rows: card.rows ?? card.position?.h ?? 2,
    mobile_show: card.mobile_show !== false,
    mobile_order: card.mobile_order ?? 0,
    position: { ...card.position },
    items: (card.items ?? []).map((item, i) => ({
      col: item.col ?? (i % w),
      row: item.row ?? Math.floor(i / w),
      ...item,
    })),
  };
}

const local = reactive(cloneCard(props.card));
const selectedCol = ref(null);
const selectedRow = ref(null);
const pickerOpen = ref(false);

const cols = computed(() => local.cols ?? 2);
const rows = computed(() => local.rows ?? 2);

const cells = computed(() => {
  const result = [];
  for (let r = 0; r < rows.value; r++)
    for (let c = 0; c < cols.value; c++)
      result.push({ col: c, row: r });
  return result;
});

function getItem(col, row) {
  return local.items.find(i => i.col === col && i.row === row) ?? null;
}

const selectedItem = computed(() => {
  if (selectedCol.value === null) return null;
  return getItem(selectedCol.value, selectedRow.value);
});

function selectCell(col, row) {
  selectedCol.value = col;
  selectedRow.value = row;
  if (!getItem(col, row)) {
    local.items.push({ col, row, type: 'sensor', title: '', mqtt_topic: '', icon: '', unit: '', round: 1, min: 0, max: 100, command_topic: '', ha_entity_id: '' });
  }
}

function removeSelected() {
  const idx = local.items.findIndex(i => i.col === selectedCol.value && i.row === selectedRow.value);
  if (idx !== -1) local.items.splice(idx, 1);
  selectedCol.value = null;
  selectedRow.value = null;
}

function save() {
  const cleaned = {
    ...local,
    cols: local.cols,
    rows: local.rows,
    mobile_show: local.mobile_show,
    mobile_order: local.mobile_order,
    position: { x: local.position.x, y: local.position.y, w: local.position.w, h: local.position.h },
    items: local.items.map(item => {
      const base = { col: item.col, row: item.row, type: item.type, title: item.title, mqtt_topic: item.mqtt_topic, icon: item.icon };
      if (item.type === 'switch') { base.command_topic = item.command_topic; base.ha_entity_id = item.ha_entity_id; }
      if (item.type === 'sensor') { base.icon = 'chip'; base.unit = item.unit; base.round = item.round ?? 1; }
      if (item.type === 'gauge') { base.icon = 'gauge'; base.min = item.min ?? 0; base.max = item.max ?? 100; base.unit = item.unit; }
      return base;
    }),
  };
  emit('save', cleaned);
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
  width: 460px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.size-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

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

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* Visual grid */
.item-grid {
  display: grid;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  height: 64px;
  background: var(--bg-card);
  border: 0;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  padding: 0.5rem;
}

/* Remove right border on last column, bottom border on last row */
.cell:nth-child(n) { border-right: 1px solid var(--border); }
.cell--active, .cell:hover { background: var(--bg-card-hover); }
.cell--active { color: var(--text-primary); outline: 2px solid var(--accent-blue); outline-offset: -2px; }
.cell--filled { color: var(--text-secondary); }

.cell-plus { font-size: 1.2rem; }
.cell-empty-icon { font-size: 1.2rem; }

.cell-label {
  font-size: 0.9rem;
  color: #9aa3bc;
  margin-top: 2px;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

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

.field-select {
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
  align-self: flex-start;
  background: none;
  border: 1px solid var(--accent-red);
  border-radius: 5px;
  color: var(--accent-red);
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.remove-item-btn:hover { background: var(--accent-red); color: #fff; }

.save-item-btn {
  align-self: flex-start;
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: #9aa3bc;
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
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
