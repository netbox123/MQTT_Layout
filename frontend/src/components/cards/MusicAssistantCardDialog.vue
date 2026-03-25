<template>
  <!-- Backdrop -->
  <div class="mad-backdrop" @click.self="$emit('close')">
    <div class="mad-panel">

      <!-- Header: tabs + close -->
      <div class="mad-header">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="mad-tab"
          :class="{ 'mad-tab--active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >{{ tab.label }}</button>
        <button class="mad-close" @click="$emit('close')">
          <svg viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose" /></svg>
        </button>
      </div>

      <!-- ── QUEUE ── -->
      <div v-if="activeTab === 'queue'" class="mad-body mad-body--nospace">
        <div v-if="queueLoading" class="mad-empty">Loading…</div>
        <div v-else-if="!queueItems.length" class="mad-empty">Queue is empty</div>
        <div v-else class="mad-list" ref="queueListEl">
          <div
            v-for="(item, idx) in queueItems"
            :key="item.queue_item_id || idx"
            :ref="el => { if (item.queue_item_id === currentItemId) currentQueueItemEl = el }"
            class="mad-row mad-row--clickable"
            :class="{ 'mad-row--current': item.queue_item_id === currentItemId }"
            @click="playQueueItem(idx)"
          >
            <span class="mad-row-idx">{{ idx + 1 }}</span>
            <img v-if="queueItemArt(item)" :src="queueItemArt(item)" class="mad-row-art" alt="" />
            <div v-else class="mad-row-art mad-row-art--empty"></div>
            <div class="mad-row-info">
              <div class="mad-row-name">{{ item.name }}</div>
              <div class="mad-row-sub">{{ queueItemArtist(item) }}</div>
            </div>
            <span class="mad-row-dur">{{ fmtTime(item.duration) }}</span>
          </div>
        </div>
      </div>

      <!-- ── PLAYER ── -->
      <div v-else-if="activeTab === 'player'" class="mad-body">
        <div class="mad-section-title">Players</div>
        <div class="mad-list mad-list--padded">
          <div
            v-for="p in visiblePlayers"
            :key="p.player_id"
            class="mad-row mad-row--clickable"
            :class="{ 'mad-row--active': p.player_id === selectedPlayerId }"
            @click="selectPlayer(p.player_id)"
          >
            <svg class="mad-row-icon" viewBox="0 0 24 24"><path :d="mdiSpeaker" fill="currentColor" /></svg>
            <div class="mad-row-info">
              <div class="mad-row-name">{{ p.display_name || p.name }}</div>
              <div class="mad-row-sub">{{ p.volume_level != null ? `vol ${p.volume_level}%` : '' }}</div>
            </div>
            <span class="mad-badge" :class="`state-${p.state}`">{{ p.state }}</span>
          </div>
        </div>
      </div>

      <!-- ── BROWSE ── -->
      <div v-else-if="activeTab === 'browse'" class="mad-body mad-body--nospace">
        <div class="mad-browse-bar">
          <button v-if="browsePath.length" class="mad-back-btn" @click="browseBack">
            <svg viewBox="0 0 24 24"><path :d="mdiChevronLeft" fill="currentColor" /></svg>
          </button>
          <span class="mad-browse-crumb">{{ browsePath.length ? browsePath[browsePath.length - 1].name : 'Browse' }}</span>
        </div>
        <div v-if="browseLoading" class="mad-empty">Loading…</div>
        <div v-else-if="!browseItems.length" class="mad-empty">Empty</div>
        <div v-else class="mad-list">
          <div
            v-for="item in browseItems"
            :key="item.uri || item.item_id"
            class="mad-row mad-row--clickable"
            @click="item.media_type !== 'folder' && browseClick(item)"
          >
            <svg class="mad-row-icon" viewBox="0 0 24 24"
              @click.stop="item.media_type === 'folder' ? browseEnter(item) : null">
              <path :d="browseIcon(item.media_type)" fill="currentColor" />
            </svg>
            <div class="mad-row-info" @click.stop="item.media_type === 'folder' ? browsePlay(item) : browseClick(item)">
              <div class="mad-row-name">{{ item.name }}</div>
              <div class="mad-row-sub">{{ browseItemSub(item) }}</div>
            </div>
            <svg v-if="item.media_type === 'folder'" class="mad-chevron" viewBox="0 0 24 24"
              @click.stop="browseEnter(item)">
              <path :d="mdiChevronRight" fill="currentColor" />
            </svg>
            <span v-else-if="item.duration" class="mad-row-dur">{{ fmtTime(item.duration) }}</span>
          </div>
        </div>
      </div>

      <!-- ── RADIO ── -->
      <div v-else-if="activeTab === 'radio'" class="mad-body mad-body--nospace">
        <div v-if="radioLoading" class="mad-empty">Loading…</div>
        <div v-else-if="!radioStations.length" class="mad-empty">No radio stations found</div>
        <div v-else class="mad-list">
          <div
            v-for="station in radioStations"
            :key="station.item_id"
            class="mad-row mad-row--clickable"
            @click="playRadio(station)"
          >
            <img v-if="radioArt(station)" :src="radioArt(station)" class="mad-row-art" alt="" />
            <div v-else class="mad-row-art mad-row-art--empty">
              <svg viewBox="0 0 24 24"><path :d="mdiRadio" fill="currentColor" /></svg>
            </div>
            <div class="mad-row-info">
              <div class="mad-row-name">{{ station.name }}</div>
              <div class="mad-row-sub">{{ station.metadata?.description || '' }}</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import {
  mdiClose, mdiSpeaker, mdiRadio,
  mdiFolder, mdiAccountMusic, mdiAlbum, mdiMusicNote,
  mdiChevronLeft, mdiChevronRight,
} from '@mdi/js';

const props = defineProps({
  ma:               { type: Object, required: true },
  activePlayerId:   { type: String, required: true },
  selectedPlayerId: { type: String, required: true },
  visiblePlayers:   { type: Array,  required: true },
  maUrl:            { type: String, default: '' },
  currentItemId:    { type: String, default: '' },
});

const emit = defineEmits(['close', 'select-player']);

const tabs = [
  { id: 'queue',  label: 'Queue'  },
  { id: 'player', label: 'Player' },
  { id: 'browse', label: 'Browse' },
  { id: 'radio',  label: 'Radio'  },
];
const activeTab = ref('queue');

function selectPlayer(id) {
  emit('select-player', id);
  emit('close');
}

// ── Queue ──────────────────────────────────────────────────────────────────
const queueItems     = ref([]);
const queueLoading   = ref(false);
const queueListEl    = ref(null);
const currentQueueItemEl = ref(null);

async function fetchQueueItems() {
  if (!props.activePlayerId) return;
  queueLoading.value = true;
  try {
    queueItems.value = await props.ma.getQueueItems(props.activePlayerId) ?? [];
  } catch { queueItems.value = []; }
  queueLoading.value = false;
  await nextTick();
  currentQueueItemEl.value?.scrollIntoView({ block: 'center' });
}

watch(activeTab, tab => { if (tab === 'queue') fetchQueueItems(); }, { immediate: true });

function playQueueItem(index) {
  props.ma.playQueueItem(props.activePlayerId, index);
  emit('close');
}

function queueItemArt(item) {
  const track = item.media_item;
  if (!track) return '';
  const imgObj = track.metadata?.images?.[0] || track.album?.metadata?.images?.[0];
  if (!imgObj?.path) return '';
  const base = (props.maUrl || 'http://192.168.0.20:8095').replace(/\/$/, '');
  const maArt = `${base}/imageproxy?path=${encodeURIComponent(encodeURIComponent(imgObj.path))}&provider=${encodeURIComponent(imgObj.provider)}&checksum=&size=64`;
  return `/api/imageproxy?url=${encodeURIComponent(maArt)}`;
}

function queueItemArtist(item) {
  const t = item.media_item;
  if (!t) return '';
  if (t.artists?.length) return t.artists.map(a => a.name).join(', ');
  return t.artist_str ?? '';
}

// ── Browse ─────────────────────────────────────────────────────────────────
const browseItems   = ref([]);
const browseLoading = ref(false);
const browsePath    = ref([]);

async function browseLoad(path) {
  browseLoading.value = true;
  try {
    const items = await props.ma.browse(path) ?? [];
    if (!path) {
      const fs = items.find(i =>
        /filesystem|local.?disk|local.?file/i.test(i.name) ||
        /filesystem/i.test(i.uri ?? i.path ?? '')
      );
      if (fs) {
        browsePath.value = [{ name: fs.name, path: fs.path ?? fs.uri }];
        browseItems.value = await props.ma.browse(fs.path ?? fs.uri) ?? [];
        browseLoading.value = false;
        return;
      }
    }
    browseItems.value = items;
  } catch { browseItems.value = []; }
  browseLoading.value = false;
}

function browseEnter(item) {
  browsePath.value = [...browsePath.value, { name: item.name, path: item.path ?? item.uri }];
  browseLoad(item.path ?? item.uri);
}

function browseBack() {
  const stack = browsePath.value.slice(0, -1);
  browsePath.value = stack;
  browseLoad(stack.length ? stack[stack.length - 1].path : undefined);
}

function browsePlay(item) {
  props.ma.playMedia(props.activePlayerId, item, 'replace');
  emit('close');
}

function browseClick(item) {
  if (item.media_type === 'folder') browseEnter(item);
  else browsePlay(item);
}

function browseItemSub(item) {
  if (item.artists?.length) return item.artists.map(a => a.name).join(', ');
  return item.artist_str ?? '';
}

function browseIcon(mediaType) {
  if (mediaType === 'folder') return mdiFolder;
  if (mediaType === 'artist') return mdiAccountMusic;
  if (mediaType === 'album')  return mdiAlbum;
  return mdiMusicNote;
}

watch(activeTab, tab => {
  if (tab === 'browse') { browsePath.value = []; browseLoad(); }
});

// ── Radio ──────────────────────────────────────────────────────────────────
const radioStations = ref([]);
const radioLoading  = ref(false);

async function fetchRadioStations() {
  radioLoading.value = true;
  try {
    radioStations.value = await props.ma.getRadioStations() ?? [];
  } catch { radioStations.value = []; }
  radioLoading.value = false;
}

watch(activeTab, tab => { if (tab === 'radio') fetchRadioStations(); });

function radioArt(station) {
  const base = (props.maUrl || 'http://192.168.0.20:8095').replace(/\/$/, '');
  const imgObj = station.metadata?.images?.[0];
  if (!imgObj?.path) return '';
  const maArt = `${base}/imageproxy?path=${encodeURIComponent(encodeURIComponent(imgObj.path))}&provider=${encodeURIComponent(imgObj.provider)}&checksum=&size=64`;
  return `/api/imageproxy?url=${encodeURIComponent(maArt)}`;
}

function playRadio(station) {
  props.ma.playMedia(props.activePlayerId, station, 'replace');
  emit('close');
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtTime(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
</script>

<style scoped>
.mad-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mad-panel {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 10px;
  width: min(480px, 96vw);
  height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ── */
.mad-header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #3d4870;
  flex-shrink: 0;
  padding: 0 0.25rem;
}

.mad-tab {
  flex-shrink: 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #9aa3bc;
  font-size: 0.85rem;
  font-weight: 500;
  font-family: inherit;
  padding: 0.6rem 0.9rem;
  cursor: pointer;
  white-space: nowrap;
}
.mad-tab--active {
  color: #e8eaf0;
  border-bottom-color: #3b82f6;
}

.mad-close {
  margin-left: auto;
  background: none;
  border: none;
  color: #9aa3bc;
  cursor: pointer;
  padding: 0.4rem;
  display: flex;
  align-items: center;
}
.mad-close svg { width: 18px; height: 18px; }
.mad-close:hover { color: #e8eaf0; }

/* ── Body ── */
.mad-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}
.mad-body--nospace {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.mad-empty {
  padding: 2rem;
  text-align: center;
  color: #9aa3bc;
  font-size: 0.875rem;
}

.mad-section-title {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9aa3bc;
  margin-bottom: 0.5rem;
}

/* ── List ── */
.mad-list {
  flex: 1;
  overflow-y: auto;
}
.mad-list--padded {
  overflow-y: visible;
}

.mad-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid rgba(61, 72, 112, 0.5);
}
.mad-row:last-child { border-bottom: none; }
.mad-row--clickable { cursor: pointer; }
.mad-row--clickable:hover { background: rgba(255,255,255,0.04); }
.mad-row--current { background: rgba(59, 130, 246, 0.15); }
.mad-row--active  { background: rgba(59, 130, 246, 0.2); }

.mad-row-idx {
  font-size: 0.7rem;
  color: #9aa3bc;
  min-width: 18px;
  text-align: right;
}

.mad-row-art {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  background: #3d4870;
}
.mad-row-art--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9aa3bc;
}
.mad-row-art--empty svg { width: 18px; height: 18px; }

.mad-row-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: #9aa3bc;
}

.mad-row-info {
  flex: 1;
  min-width: 0;
}
.mad-row-name {
  font-size: 0.875rem;
  color: #e8eaf0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mad-row-sub {
  font-size: 0.75rem;
  color: #9aa3bc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mad-row-dur {
  font-size: 0.72rem;
  color: #9aa3bc;
  flex-shrink: 0;
}

.mad-badge {
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: #3d4870;
  color: #9aa3bc;
  flex-shrink: 0;
}
.mad-badge.state-playing { background: rgba(34, 197, 94, 0.2); color: #4ade80; }

.mad-chevron {
  width: 18px;
  height: 18px;
  color: #9aa3bc;
  flex-shrink: 0;
  cursor: pointer;
}

/* ── Browse bar ── */
.mad-browse-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #3d4870;
  flex-shrink: 0;
}
.mad-back-btn {
  background: none;
  border: none;
  color: #9aa3bc;
  cursor: pointer;
  padding: 0.1rem;
  display: flex;
  align-items: center;
}
.mad-back-btn svg { width: 20px; height: 20px; }
.mad-back-btn:hover { color: #e8eaf0; }
.mad-browse-crumb {
  font-size: 0.85rem;
  font-weight: 500;
  color: #e8eaf0;
}
</style>
