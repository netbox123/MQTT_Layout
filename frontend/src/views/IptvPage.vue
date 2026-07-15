<template>
  <div class="iptv-page">
    <!-- Top: filter bar -->
    <div class="filter-bar">
      <div class="tab-bar tab-bar--top">
        <button
          class="tab-btn" :class="{ 'tab-btn--active': view === 'all' }"
          @click="view = 'all'"
        >All</button>
        <button
          class="tab-btn" :class="{ 'tab-btn--active': view === 'favorites' }"
          @click="view = 'favorites'"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" class="tab-icon"><path :d="mdiStar" /></svg>
          Favorites
        </button>
      </div>

      <div class="filter-controls">
        <input
          v-model="search"
          type="text"
          class="search-input"
          placeholder="Search channels..."
        />
        <select v-model="selectedCountry" class="filter-select">
          <option value="">All countries</option>
          <option v-for="c in store.countries" :key="c.code" :value="c.code">
            {{ c.flag }} {{ c.name }}
          </option>
        </select>
        <select v-model="selectedCategory" class="filter-select">
          <option value="">All categories</option>
          <option v-for="c in store.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
    </div>

    <!-- Player -->
    <div v-if="activeChannel" class="player-panel">
      <div class="player-header">
        <span class="player-title">{{ activeChannel.name }}</span>
        <button class="player-close" @click="closePlayer">✕</button>
      </div>
      <video ref="videoEl" class="player-video" controls autoplay playsinline></video>
      <div v-if="playerError" class="player-error">Stream unavailable — try another channel.</div>
    </div>

    <!-- Channel list -->
    <div v-if="store.loading && !store.loaded" class="empty">Loading channels…</div>
    <div v-else-if="!filtered.length" class="empty">No channels match your filters.</div>
    <div v-else ref="viewport" class="list-viewport" @scroll="onScroll">
      <div class="list-spacer" :style="{ height: filtered.length * ROW_H + 'px' }">
        <div class="list-window" :style="{ transform: `translateY(${startIndex * ROW_H}px)` }">
          <div
            v-for="ch in visibleChannels"
            :key="ch.id"
            class="channel-row"
            :class="{ 'channel-row--active': activeChannel?.id === ch.id }"
            :style="{ height: ROW_H + 'px' }"
            @click="playChannel(ch)"
          >
            <div class="col-logo">
              <img v-if="ch.logo" :src="ch.logo" class="channel-logo" loading="lazy" @error="onLogoError" />
              <div v-else class="channel-logo channel-logo--placeholder">
                <svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon"><path :d="mdiTelevision" /></svg>
              </div>
            </div>
            <div class="col-name channel-name">{{ ch.name }}</div>
            <div class="col-country">
              <span class="country-flag">{{ ch.flag }}</span>
              <span class="country-text">{{ ch.countryName }}</span>
            </div>
            <button class="favorite-btn" @click.stop="store.toggleFavorite(ch.id)">
              <svg viewBox="0 0 24 24" fill="currentColor" class="favorite-icon">
                <path :d="store.isFavorite(ch.id) ? mdiStar : mdiStarOutline" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { mdiStar, mdiStarOutline, mdiTelevision } from '@mdi/js';
import Hls from 'hls.js';
import { useIptvStore } from '../stores/iptvStore.js';

defineProps({
  pageConfig: { type: Object, default: () => ({}) },
});

const store = useIptvStore();

const view             = ref('all');
const search           = ref('');
const selectedCountry  = ref('');
const selectedCategory = ref('');

const filtered = computed(() => {
  let list = store.channels;
  if (view.value === 'favorites') {
    const favSet = new Set(store.favorites);
    list = list.filter(ch => favSet.has(ch.id));
  }
  if (selectedCountry.value) list = list.filter(ch => ch.country === selectedCountry.value);
  if (selectedCategory.value) list = list.filter(ch => ch.categoryIds.includes(selectedCategory.value));
  const q = search.value.trim().toLowerCase();
  if (q) list = list.filter(ch => ch.name.toLowerCase().includes(q));
  return list;
});

// ── Simple windowed rendering (avoids ~15k DOM rows) ──────────────────────
const ROW_H = 44;
const BUFFER = 6;
const viewport = ref(null);
const scrollTop = ref(0);
const viewportHeight = ref(600);

const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_H) - BUFFER));
const endIndex = computed(() =>
  Math.min(filtered.value.length, Math.ceil((scrollTop.value + viewportHeight.value) / ROW_H) + BUFFER)
);
const visibleChannels = computed(() => filtered.value.slice(startIndex.value, endIndex.value));

function onScroll() {
  scrollTop.value = viewport.value?.scrollTop ?? 0;
}
function measureViewport() {
  if (viewport.value) viewportHeight.value = viewport.value.clientHeight;
}
watch(filtered, () => { if (viewport.value) viewport.value.scrollTop = 0; scrollTop.value = 0; });

function onLogoError(e) {
  e.target.style.display = 'none';
}

// ── Player ─────────────────────────────────────────────────────────────
const activeChannel      = ref(null);
const activeStreamIndex  = ref(0);
const playerError        = ref(false);
const videoEl            = ref(null);
let hls = null;

function destroyPlayer() {
  if (hls) { hls.destroy(); hls = null; }
}

function attachPlayer() {
  destroyPlayer();
  const video = videoEl.value;
  if (!video || !activeChannel.value) return;
  const url = `/api/iptv/stream?channel=${encodeURIComponent(activeChannel.value.id)}&stream=${activeStreamIndex.value}`;

  if (Hls.isSupported()) {
    hls = new Hls();
    hls.on(Hls.Events.ERROR, (_evt, data) => { if (data.fatal) tryNextStream(); });
    hls.loadSource(url);
    hls.attachMedia(video);
    video.play().catch(() => {});
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.addEventListener('error', tryNextStream, { once: true });
    video.play().catch(() => {});
  } else {
    playerError.value = true;
  }
}

function tryNextStream() {
  const next = activeStreamIndex.value + 1;
  if (activeChannel.value && next < activeChannel.value.streams.length) {
    activeStreamIndex.value = next;
    attachPlayer();
  } else {
    playerError.value = true;
  }
}

function playChannel(ch) {
  activeChannel.value = ch;
  activeStreamIndex.value = 0;
  playerError.value = false;
  nextTick(attachPlayer);
}

function closePlayer() {
  destroyPlayer();
  activeChannel.value = null;
}

onMounted(() => {
  store.load();
  measureViewport();
  window.addEventListener('resize', measureViewport);
});
onUnmounted(() => {
  destroyPlayer();
  window.removeEventListener('resize', measureViewport);
});
</script>

<style scoped>
.iptv-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
}

.filter-bar {
  flex-shrink: 0;
  min-width: 0;
  overflow: hidden;
  border-bottom: 1px solid #1e1e28;
}

.tab-bar {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem 1rem 0.35rem;
  overflow-x: auto;
  scrollbar-width: none;
}
.tab-bar::-webkit-scrollbar { display: none; }

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: #18181c;
  border: 1px solid #2e2e3a;
  border-radius: 8px;
  color: #666;
  font-size: 0.78rem;
  font-family: inherit;
  font-weight: 600;
  letter-spacing: 0.03em;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.tab-btn:hover { color: #aaa; border-color: #444; }
.tab-btn--active { color: #5090d0; border-color: #5090d0; background: #0e1a2e; }

.tab-icon { width: 14px; height: 14px; flex-shrink: 0; }

.filter-controls {
  display: flex;
  gap: 0.5rem;
  padding: 0.35rem 1rem 0.6rem;
  flex-wrap: wrap;
  max-width: 100%;
  overflow: hidden;
}

.search-input, .filter-select {
  background: #18181c;
  border: 1px solid #2e2e3a;
  border-radius: 8px;
  color: #ddd;
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.4rem 0.6rem;
  min-width: 0;
  box-sizing: border-box;
}
.search-input { flex: 1 1 140px; }
/* Some browsers (Safari especially) size a closed <select> to fit its widest
   <option>, not the selected one — country names run up to 32 chars, so this
   must be capped explicitly or it drags the whole filter row wide. */
.filter-select {
  flex: 1 1 130px;
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-input:focus, .filter-select:focus { outline: none; border-color: #5090d0; }

.player-panel {
  flex-shrink: 0;
  background: #000;
  border-bottom: 1px solid #1e1e28;
}
.player-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.8rem;
}
.player-title { color: #ddd; font-size: 0.85rem; font-weight: 600; }
.player-close {
  background: none;
  border: none;
  color: #888;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
}
.player-close:hover { color: #eee; }
.player-video {
  width: 100%;
  max-height: 40vh;
  background: #000;
  display: block;
}
.player-error {
  color: #d05050;
  font-size: 0.8rem;
  padding: 0.5rem 0.8rem;
}

.empty {
  color: #555;
  font-size: 0.9rem;
  margin-top: 3rem;
  text-align: center;
}

.list-viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.list-spacer { position: relative; width: 100%; }
.list-window { position: absolute; top: 0; left: 0; right: 0; }

.channel-row {
  /* Flexbox, not Grid: Safari's min-width:0 handling for shrinking children
     is far more reliable in flex layouts than in grid, and grid was the
     source of a persistent Safari-only overflow here. */
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0 1rem;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
  border-bottom: 1px solid #17171d;
}
.channel-row:hover { background: #131318; }
.channel-row--active { background: #0e1a2e; }

.col-logo { flex: 0 0 32px; width: 32px; height: 32px; }
.channel-logo {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 6px;
  background: #18181c;
}
.channel-logo--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #444;
}
.placeholder-icon { width: 16px; height: 16px; }

.col-name {
  flex: 0 1 260px;
  min-width: 0;
  color: #ddd;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-country {
  flex: 0 1 150px;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  color: #888;
  font-size: 0.75rem;
}
.country-flag { flex-shrink: 0; }
.country-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-btn {
  /* margin-left:auto eats all remaining space, pinning this to the row's
     right edge without needing a dummy spacer element. */
  margin-left: auto;
  flex: 0 0 28px;
  background: none;
  border: none;
  color: #555;
  cursor: pointer;
  padding: 0.3rem;
}
.favorite-btn:hover { color: #e0b030; }
.favorite-icon { width: 18px; height: 18px; }

/* Narrow viewports: drop the country name, keep just the flag, to guarantee
   the row never needs horizontal scrolling to reach the favorite button. */
@media (max-width: 480px) {
  .col-name { flex-basis: 0; flex-grow: 1; }
  .col-country { flex: 0 0 auto; }
  .country-text { display: none; }
}
</style>
