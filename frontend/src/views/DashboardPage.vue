<template>
  <div class="dashboard" :class="{ 'dashboard--flush': Number(page.grid_spacing) === 0 && !editing }">
    <div class="page-header">
      <h1 class="page-title">{{ page.name }}</h1>
      <button class="add-card-btn" :style="{ visibility: editing ? 'visible' : 'hidden' }" title="Add card" @click="showPicker = true">+</button>
    </div>
    <div ref="gridRef" class="card-grid" :style="{ gap: (page.grid_spacing ?? 16) + 'px', gridAutoRows: (page.card_height ?? 120) + 'px', gridTemplateColumns: `repeat(${gridCols || 'auto-fill'}, ${page.card_width ?? 150}px)` }">
      <div
        v-for="(card, i) in page.cards"
        :key="i"
        :ref="el => { if (el) cardEls[i] = el }"
        class="card-wrapper"
        :class="{ 'card-wrapper--editing': editing }"
        :style="gridStyle(card.position)"
        @mousedown="editing ? startDrag($event, i) : undefined"
      >
        <component :is="cardComponent(card.type)" :card="card" :ref="el => { if (el) cardCompRefs[i] = el }" />
        <button v-if="editing && card.type === 'url'" class="card-url-add-btn" title="Add link" @click.stop="cardCompRefs[i]?.openAdd()">+</button>
        <button v-if="editing && card.type === 'color'" class="card-url-add-btn" title="Add preset" @click.stop="cardCompRefs[i]?.openAdd()">+</button>
        <button v-if="editing" class="card-edit-btn" title="Edit card" @click.stop="openEdit(i)">✎</button>
        <div v-if="editing" class="resize-handle" @mousedown.stop="startResize($event, i)" />
      </div>
    </div>
    <CardPickerModal
      v-if="showPicker"
      @pick="onPick"
      @cancel="showPicker = false"
    />
    <GridCardEditModal
      v-if="editingCardIndex !== null && currentEditCard?.type === 'grid'"
      :card="currentEditCard"
      :isNew="editingCardIndex === 'new'"
      @save="handleSave"
      @cancel="editingCardIndex = null"
      @delete="deleteCard"
    />
    <EntitiesCardEditModal
      v-if="editingCardIndex !== null && currentEditCard?.type === 'entities'"
      :card="currentEditCard"
      :isNew="editingCardIndex === 'new'"
      @save="handleSave"
      @cancel="editingCardIndex = null"
      @delete="deleteCard"
    />
    <NotificationCardEditModal
      v-if="editingCardIndex !== null && currentEditCard?.type === 'notification'"
      :card="currentEditCard"
      :isNew="editingCardIndex === 'new'"
      @save="handleSave"
      @apply="applyCard"
      @cancel="editingCardIndex = null"
      @delete="deleteCard"
    />
    <MusicAssistantCardEditModal
      v-if="editingCardIndex !== null && currentEditCard?.type === 'musicassistant'"
      :card="currentEditCard"
      :isNew="editingCardIndex === 'new'"
      @save="handleSave"
      @cancel="editingCardIndex = null"
      @delete="deleteCard"
    />
    <ColorCardEditModal
      v-if="editingCardIndex !== null && editingCardIndex !== 'new' && currentEditCard?.type === 'color'"
      :card="currentEditCard"
      :isNew="editingCardIndex === 'new'"
      @save="handleSave"
      @cancel="editingCardIndex = null"
      @delete="deleteCard"
    />
    <UrlCardEditModal
      v-if="editingCardIndex !== null && editingCardIndex !== 'new' && currentEditCard?.type === 'url'"
      :card="currentEditCard"
      :isNew="editingCardIndex === 'new'"
      @save="handleSave"
      @cancel="editingCardIndex = null"
      @delete="deleteCard"
    />
    <WledCardEditModal
      v-if="editingCardIndex !== null && currentEditCard?.type === 'wled'"
      :card="currentEditCard"
      :isNew="editingCardIndex === 'new'"
      @save="handleSave"
      @cancel="editingCardIndex = null"
      @delete="deleteCard"
    />
    <WiimCardEditModal
      v-if="editingCardIndex !== null && currentEditCard?.type === 'wiim'"
      :card="currentEditCard"
      :isNew="editingCardIndex === 'new'"
      @save="handleSave"
      @cancel="editingCardIndex = null"
      @delete="deleteCard"
    />
    <DeviceCardEditModal
      v-if="editingCardIndex !== null && (currentEditCard?.type === 'machine' || currentEditCard?.type === 'tv')"
      :card="currentEditCard"
      :isNew="editingCardIndex === 'new'"
      @save="handleSave"
      @cancel="editingCardIndex = null"
      @delete="deleteCard"
    />
    <CardEditModal
      v-if="editingCardIndex !== null && currentEditCard?.type !== 'grid' && currentEditCard?.type !== 'entities' && currentEditCard?.type !== 'musicassistant' && currentEditCard?.type !== 'notification' && currentEditCard?.type !== 'machine' && currentEditCard?.type !== 'tv' && currentEditCard?.type !== 'wled' && currentEditCard?.type !== 'wiim' && !(currentEditCard?.type === 'url' && editingCardIndex !== 'new') && !(currentEditCard?.type === 'color' && editingCardIndex !== 'new')"
      :card="currentEditCard"
      :isNew="editingCardIndex === 'new'"
      :title="currentEditCard?.type === 'weather' ? (editingCardIndex === 'new' ? 'New Weather Card' : 'Edit Weather Card') : currentEditCard?.type === 'camera' ? (editingCardIndex === 'new' ? 'New Camera Card' : 'Edit Camera Card') : currentEditCard?.type === 'webpage' ? (editingCardIndex === 'new' ? 'New Webpage Card' : 'Edit Webpage Card') : currentEditCard?.type === 'pizza' ? (editingCardIndex === 'new' ? 'New Pizza Card' : 'Edit Pizza Card') : currentEditCard?.type === 'url' ? (editingCardIndex === 'new' ? 'New Url Card' : 'Edit Url Card') : currentEditCard?.type === 'machine' ? (editingCardIndex === 'new' ? 'New Machines Card' : 'Edit Machines') : currentEditCard?.type === 'tv' ? (editingCardIndex === 'new' ? 'New TVs Card' : 'Edit TVs') : ''"
      :hiddenFields="currentEditCard?.type === 'pizza' ? ['title', 'mqtt_topic'] : currentEditCard?.type === 'url' ? ['title', 'mqtt_topic'] : currentEditCard?.type === 'color' ? ['title', 'mqtt_topic'] : []"
      @save="handleSave"
      @cancel="editingCardIndex = null"
      @delete="deleteCard"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, inject, onMounted, onUnmounted } from 'vue';
import SensorCard from '../components/cards/SensorCard.vue';
import GaugeCard from '../components/cards/GaugeCard.vue';
import SwitchCard from '../components/cards/SwitchCard.vue';
import TextCard from '../components/cards/TextCard.vue';
import ButtonCard from '../components/cards/ButtonCard.vue';
import CameraCard from '../components/cards/CameraCard.vue';
import WebpageCard from '../components/cards/WebpageCard.vue';
import GridCard from '../components/cards/GridCard.vue';
import IndicatorCard from '../components/cards/IndicatorCard.vue';
import WeatherCard from '../components/cards/WeatherCard.vue';
import EntitiesCard from '../components/cards/EntitiesCard.vue';
import MusicAssistantCard from '../components/cards/MusicAssistantCard.vue';
import NotificationCard from '../components/cards/NotificationCard.vue';
import MachineCard from '../components/cards/MachineCard.vue';
import TvCard from '../components/cards/TvCard.vue';
import RecipeCard from '../components/cards/RecipeCard.vue';
import PizzaCard from '../components/cards/PizzaCard.vue';
import UrlCard from '../components/cards/UrlCard.vue';
import ColorCard from '../components/cards/ColorCard.vue';
import WledCard from '../components/cards/WledCard.vue';
import WiimCard from '../components/cards/WiimCard.vue';
import CardEditModal from '../components/dialogs/CardEditModal.vue';
import GridCardEditModal from '../components/dialogs/GridCardEditModal.vue';
import EntitiesCardEditModal from '../components/dialogs/EntitiesCardEditModal.vue';
import UrlCardEditModal from '../components/dialogs/UrlCardEditModal.vue';
import ColorCardEditModal from '../components/dialogs/ColorCardEditModal.vue';
import WledCardEditModal from '../components/dialogs/WledCardEditModal.vue';
import WiimCardEditModal from '../components/dialogs/WiimCardEditModal.vue';
import MusicAssistantCardEditModal from '../components/dialogs/MusicAssistantCardEditModal.vue';
import NotificationCardEditModal from '../components/dialogs/NotificationCardEditModal.vue';
import DeviceCardEditModal from '../components/dialogs/DeviceCardEditModal.vue';
import CardPickerModal from '../components/dialogs/CardPickerModal.vue';

const props = defineProps({
  pageConfig: { type: Object, required: true },
});

// Wrap in reactive so mutations (drag/resize position updates) trigger re-renders
const page = reactive(props.pageConfig);

const editing = inject('editing');
const editingCardIndex = ref(null);
const showPicker = ref(false);
const currentEditCard = computed(() =>
  editingCardIndex.value === null ? null
  : editingCardIndex.value === 'new' ? newCardTemplate.value
  : page.cards[editingCardIndex.value]
);

const gridRef = ref(null);
const cardEls = [];
const cardCompRefs = [];
const gridCols = ref(0);

onMounted(() => {
  gridCols.value = window.getComputedStyle(gridRef.value)
    .getPropertyValue('grid-template-columns').split(' ').length || 6;
});

function getGridCols() {
  return gridCols.value || 6;
}

function getCellMetrics() {
  return {
    cellW: page.card_width ?? 150,
    cellH: page.card_height ?? 120,
    gap: page.grid_spacing ?? 16,
  };
}

function pixelToGrid(px, py, w) {
  const { cellW, cellH, gap } = getCellMetrics();
  const col = Math.max(1, Math.min(getGridCols() - w + 1, Math.round(px / (cellW + gap)) + 1));
  const row = Math.max(1, Math.round(py / (cellH + gap)) + 1);
  return { col, row };
}

// ── Drag ────────────────────────────────────────────────────────────────────
let dragState = null;

function startDrag(event, index) {
  if (event.target.closest('button, .resize-handle')) return;
  event.preventDefault();
  const el = cardEls[index];
  const gridRect = gridRef.value.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  dragState = {
    index, el,
    startX: event.clientX, startY: event.clientY,
    gridLeft: gridRect.left,
    gridTop: gridRect.top,
    offsetX: event.clientX - elRect.left,
    offsetY: event.clientY - elRect.top,
  };
  el.style.zIndex = '100';
  el.style.opacity = '0.8';
  el.style.cursor = 'grabbing';
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
}

function onDragMove(event) {
  if (!dragState) return;
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;
  dragState.el.style.transform = `translate(${dx}px, ${dy}px)`;
}

function onDragEnd(event) {
  if (!dragState) return;
  const { el, index, gridLeft, gridTop, offsetX, offsetY } = dragState;

  el.style.transform = '';
  el.style.zIndex = '';
  el.style.opacity = '';
  el.style.cursor = '';
  document.body.style.userSelect = '';

  dragState = null;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);

  const px = event.clientX - gridLeft - offsetX;
  const py = event.clientY - gridTop - offsetY;
  const card = page.cards[index];
  const { col, row } = pixelToGrid(px, py, card.position.w);
  if (col !== card.position.x || row !== card.position.y) {
    savePosition(index, { ...card.position, x: col, y: row });
  }
}

// ── Resize ───────────────────────────────────────────────────────────────────
let resizeState = null;

function startResize(event, index) {
  event.preventDefault();
  const card = page.cards[index];
  resizeState = {
    index,
    startX: event.clientX,
    startY: event.clientY,
    startW: card.position.w,
    startH: card.position.h,
  };
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', onResizeMove);
  window.addEventListener('mouseup', onResizeEnd);
}

function onResizeMove(event) {
  if (!resizeState) return;
  const { cellW, cellH, gap } = getCellMetrics();
  const { index, startX, startY, startW, startH } = resizeState;
  const card = page.cards[index];
  const dx = event.clientX - startX;
  const dy = event.clientY - startY;
  card.position.w = Math.max(1, Math.min(getGridCols() - card.position.x + 1, startW + Math.round(dx / (cellW + gap))));
  card.position.h = Math.max(1, startH + Math.round(dy / (cellH + gap)));
}

function onResizeEnd() {
  if (!resizeState) return;
  const { index } = resizeState;
  resizeState = null;
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', onResizeMove);
  window.removeEventListener('mouseup', onResizeEnd);
  savePosition(index, { ...page.cards[index].position });
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  window.removeEventListener('mousemove', onResizeMove);
  window.removeEventListener('mouseup', onResizeEnd);
  document.body.style.userSelect = '';
});

// ── Save position ─────────────────────────────────────────────────────────────
async function savePosition(index, position) {
  const oldCard = page.cards[index];
  const newCard = { ...oldCard, position };
  page.cards[index] = newCard; // optimistic update
  const slug = page.path.replace(/^\//, '');
  const res = await fetch(`/api/pages/${slug}/cards/${index}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newCard),
  });
  if (!res.ok) {
    page.cards[index] = oldCard; // revert on failure
  }
}

// ── Card defaults & picker ────────────────────────────────────────────────────
const cardDefaults = {
  sensor: { type: 'sensor', title: 'New Sensor', mqtt_topic: '', unit: '', round: 1, position: { x: 1, y: 1, w: 2, h: 1 } },
  gauge:  { type: 'gauge',  title: 'New Gauge',  mqtt_topic: '', unit: '', min: 0, max: 100, round: 1, position: { x: 1, y: 1, w: 2, h: 2 } },
  switch: { type: 'switch', title: 'New Switch', mqtt_topic: '', ha_entity_id: '', icon: '', position: { x: 1, y: 1, w: 2, h: 1 } },
  grid:      { type: 'grid',      title: 'New Grid',      items: [], cols: 2, rows: 2, position: { x: 1, y: 1, w: 2, h: 2 } },
  indicator: { type: 'indicator', title: 'New Indicator', mqtt_topic: '', icon: '',   position: { x: 1, y: 1, w: 2, h: 1 } },
  text:   { type: 'text',   title: 'New Text',   mqtt_topic: '', position: { x: 1, y: 1, w: 2, h: 1 } },
  button: { type: 'button', title: 'New Button', mqtt_topic: '', payload: '', position: { x: 1, y: 1, w: 2, h: 1 } },
  camera:   { type: 'camera',   title: 'New Camera',  stream_url: '', position: { x: 1, y: 1, w: 3, h: 2 } },
  webpage:  { type: 'webpage',  title: '',             url: '',        position: { x: 1, y: 1, w: 3, h: 2 } },
  weather:   { type: 'weather',   location_name: 'Weather', lat: '', lon: '', position: { x: 1, y: 1, w: 3, h: 3 } },
  entities:  { type: 'entities',  rows: 2, items: [], position: { x: 1, y: 1, w: 2, h: 2 } },
  musicassistant: { type: 'musicassistant', title: 'Music Assistant', ma_url: 'http://192.168.0.20:8095', ma_token: '', position: { x: 1, y: 1, w: 3, h: 3 } },
  notification: { type: 'notification', title: 'New Notification Card', max_items: 20, position: { x: 1, y: 1, w: 2, h: 3 } },
  machine: { type: 'machine', title: 'Machines', mqtt_prefix: 'site_dashboard/machines', position: { x: 1, y: 1, w: 2, h: 3 } },
  tv: { type: 'tv', title: 'TVs', mqtt_prefix: 'site_dashboard/tvs', position: { x: 1, y: 1, w: 2, h: 3 } },
  pizza: { type: 'pizza', position: { x: 1, y: 1, w: 4, h: 4 } },
  url: { type: 'url', title: 'Links', position: { x: 1, y: 1, w: 2, h: 3 } },
  color: { type: 'color', position: { x: 1, y: 1, w: 2, h: 3 } },
  wled: { type: 'wled', title: 'WLED', devices: [], position: { x: 1, y: 1, w: 2, h: 3 } },
  wiim: { type: 'wiim', title: 'WiiM Pro', ip: '192.168.0.22', position: { x: 1, y: 1, w: 3, h: 2 } },
};

function findEmptyPosition(w, h) {
  const occupied = new Set();
  for (const card of page.cards) {
    const { x, y, w: cw, h: ch } = card.position;
    for (let row = y; row < y + ch; row++)
      for (let col = x; col < x + cw; col++)
        occupied.add(`${col},${row}`);
  }
  for (let row = 1; row <= 100; row++) {
    for (let col = 1; col <= 6 - w + 1; col++) {
      let fits = true;
      outer: for (let dy = 0; dy < h; dy++)
        for (let dx = 0; dx < w; dx++)
          if (occupied.has(`${col + dx},${row + dy}`)) { fits = false; break outer; }
      if (fits) return { x: col, y: row, w, h };
    }
  }
  return { x: 1, y: 1, w, h };
}

const defaultCard = { type: '', title: 'New Card', mqtt_topic: '', position: { x: 1, y: 1, w: 2, h: 1 } };
const newCardTemplate = ref(null);

function onPick(typeId) {
  showPicker.value = false;
  const defaults = { ...(cardDefaults[typeId] ?? { ...defaultCard, type: typeId }) };
  defaults.position = findEmptyPosition(defaults.position.w, defaults.position.h);
  newCardTemplate.value = defaults;
  editingCardIndex.value = 'new';
}

// ── Type map ──────────────────────────────────────────────────────────────────
const typeMap = {
  sensor: SensorCard,
  gauge: GaugeCard,
  switch: SwitchCard,
  text: TextCard,
  button: ButtonCard,
  camera: CameraCard,
  webpage: WebpageCard,
  grid: GridCard,
  indicator: IndicatorCard,
  weather: WeatherCard,
  entities: EntitiesCard,
  musicassistant: MusicAssistantCard,
  notification: NotificationCard,
  machine: MachineCard,
  tv: TvCard,
  recipe: RecipeCard,
  pizza: PizzaCard,
  url: UrlCard,
  color: ColorCard,
  wled: WledCard,
  wiim: WiimCard,
};

function cardComponent(type) {
  return typeMap[type] ?? TextCard;
}

function gridStyle(pos) {
  return {
    gridColumn: `${pos.x} / span ${pos.w}`,
    gridRow: `${pos.y} / span ${pos.h}`,
  };
}

// ── Edit / save / delete ──────────────────────────────────────────────────────
function openEdit(index) {
  editingCardIndex.value = index;
}

function handleSave(card) {
  if (editingCardIndex.value === 'new') addCard(card);
  else saveCard(card);
}

async function saveCard(updatedCard) {
  const slug = page.path.replace(/^\//, '');
  const res = await fetch(`/api/pages/${slug}/cards/${editingCardIndex.value}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedCard),
  });
  if (res.ok) {
    page.cards[editingCardIndex.value] = updatedCard;
    editingCardIndex.value = null;
  }
}

// Save without closing the modal (used by notification edit dialog)
async function applyCard(updatedCard) {
  if (editingCardIndex.value === 'new') {
    await addCard(updatedCard);           // addCard closes on its own for new cards
    return;
  }
  const slug = page.path.replace(/^\//, '');
  const res = await fetch(`/api/pages/${slug}/cards/${editingCardIndex.value}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedCard),
  });
  if (res.ok) page.cards[editingCardIndex.value] = updatedCard;
  // intentionally keep editingCardIndex open
}

async function deleteCard() {
  const slug = page.path.replace(/^\//, '');
  const res = await fetch(`/api/pages/${slug}/cards/${editingCardIndex.value}`, {
    method: 'DELETE',
  });
  if (res.ok) {
    page.cards.splice(editingCardIndex.value, 1);
    editingCardIndex.value = null;
  }
}

async function addCard(newCard) {
  const slug = page.path.replace(/^\//, '');
  const res = await fetch(`/api/pages/${slug}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newCard),
  });
  if (res.ok) {
    const saved = await res.json();
    page.cards.push(saved);
    editingCardIndex.value = null;
    newCardTemplate.value = null;
  }
}
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dashboard--flush {
  margin: 0 -0.75rem -0.75rem;
  gap: 0;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  margin: -0.75rem -0.75rem 0;
  padding: 0.35rem 0.75rem 0.45rem 1.625rem;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.add-card-btn {
  background: transparent;
  border: none;
  border-radius: 5px;
  color: var(--text-secondary);
  font-size: 1rem;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: color 0.15s, border-color 0.15s;
}

.add-card-btn:hover {
  color: var(--accent-blue);
}

.card-grid {
  display: grid;
}

.card-wrapper {
  position: relative;
}

.card-wrapper > :first-child {
  width: 100%;
  height: 100%;
}

.card-wrapper--editing {
  cursor: grab;
}

.card-wrapper--editing:active {
  cursor: grabbing;
}

.card-url-add-btn {
  position: absolute;
  top: 0.4rem;
  right: calc(0.4rem + 28px);
  z-index: 10;
  background: var(--bg-card-hover);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 1rem;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: color 0.15s, background 0.15s;
  cursor: pointer;
}

.card-url-add-btn:hover {
  color: var(--accent-blue);
  background: var(--bg-surface);
}

.card-edit-btn {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  z-index: 10;
  background: var(--bg-card-hover);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
  cursor: pointer;
}

.card-edit-btn:hover {
  color: var(--accent-blue);
  background: var(--bg-surface);
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 18px;
  height: 18px;
  cursor: se-resize;
  z-index: 2;
  /* draw a small corner indicator */
  background: linear-gradient(135deg, transparent 50%, var(--border) 50%);
  border-bottom-right-radius: 8px;
}

.resize-handle:hover {
  background: linear-gradient(135deg, transparent 50%, var(--accent-blue) 50%);
}
</style>
