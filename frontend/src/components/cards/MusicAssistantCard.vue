<template>
  <div class="card ma-card" :style="accentBg ? { background: accentBg } : {}">

    <!-- Error / connecting states -->
    <div v-if="!ma.authed.value" class="ma-state">
      <span v-if="ma.error.value" class="ma-error">{{ ma.error.value }}</span>
      <span v-else-if="!ma.connected.value">Connecting to Music Assistant…</span>
      <span v-else>Authenticating…</span>
    </div>

    <template v-else>
      <!-- Background album art -->
      <img v-if="artUrl" :src="artUrl" class="ma-bg-art" alt="" />

      <!-- Player name + 3-dots button -->
      <div class="ma-player-name" :style="{ color: accentFg }">
        <svg viewBox="0 0 24 24" fill="currentColor" class="ma-player-icon"><path :d="mdiSpeaker" /></svg>
        {{ activePlayer?.display_name || activePlayer?.name }}
        <button class="ma-dots-btn" :style="{ color: accentFg }" @click.stop="dialogOpen = true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path :d="mdiDotsVertical" /></svg>
        </button>
      </div>

      <!-- Track info -->
      <div class="ma-info">
        <div class="ma-track" :style="{ color: accentFg }">{{ currentTrack?.name ?? '—' }}</div>
        <div class="ma-artist" :style="{ color: accentFg }">{{ artist }}</div>
        <div v-if="album" class="ma-album" :style="{ color: accentFg, opacity: 0.7 }">{{ album }}</div>
      </div>

      <!-- Controls -->
      <div class="ma-controls">
        <div class="ma-btns">
          <button class="ma-btn" :style="{ color: accentFg }" @click="ma.previous(activePlayerId)">
            <svg viewBox="0 0 24 24" fill="currentColor"><path :d="mdiSkipPrevious" /></svg>
          </button>
          <button class="ma-btn ma-btn-play" :style="{ color: accentFg }" @click="ma.playPause(activePlayerId)">
            <svg viewBox="0 0 24 24" fill="currentColor"><path :d="isPlaying ? mdiPause : mdiPlay" /></svg>
          </button>
          <button class="ma-btn" :style="{ color: accentFg }" @click="ma.next(activePlayerId)">
            <svg viewBox="0 0 24 24" fill="currentColor"><path :d="mdiSkipNext" /></svg>
          </button>
          <button class="ma-btn ma-btn-sm" :class="{ active: shuffleEnabled }" :style="{ color: accentFg }" @click="toggleShuffle">
            <svg viewBox="0 0 24 24" fill="currentColor"><path :d="mdiShuffle" /></svg>
          </button>
          <button class="ma-btn ma-btn-sm" :class="{ active: repeatMode !== 'off' }" :style="{ color: accentFg }" @click="cycleRepeat">
            <svg viewBox="0 0 24 24" fill="currentColor"><path :d="repeatMode === 'one' ? mdiRepeatOnce : mdiRepeat" /></svg>
          </button>
        </div>
      </div>

      <!-- Progress bar pinned to bottom -->
      <div class="ma-progress-row" style="position:absolute; bottom:0.75rem; left:0.75rem; right:0.75rem; z-index:2;">
        <span class="ma-time" :style="{ color: accentFg }">{{ fmtTime(localElapsed) }}</span>
        <div class="ma-progress-track" @click="onSeek">
          <div class="ma-progress-fill" :style="{ width: progressPct + '%', background: accentFg }"></div>
        </div>
        <span class="ma-time ma-time--remaining" :style="{ color: accentFg }">-{{ fmtTime(Math.max(0, duration - localElapsed)) }}</span>
      </div>

    </template>

    <!-- 3-dots dialog (teleported to body to escape card stacking context) -->
    <Teleport to="body">
      <MusicAssistantCardDialog
        v-if="dialogOpen"
        :ma="ma"
        :active-player-id="activePlayerId"
        :selected-player-id="selectedPlayerId"
        :visible-players="visiblePlayers"
        :ma-url="props.card.ma_url || ''"
        :current-item-id="activeQueue?.current_item?.queue_item_id || ''"
        @close="dialogOpen = false"
        @select-player="id => { selectedPlayerId = id; dialogOpen = false }"
      />
    </Teleport>
  </div>
</template>

<script>
export const icon = '🎵';
</script>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { useMusicAssistant } from '../../composables/useMusicAssistant.js';
import MusicAssistantCardDialog from './MusicAssistantCardDialog.vue';
import {
  mdiPlay, mdiPause, mdiSkipNext, mdiSkipPrevious,
  mdiShuffle, mdiRepeat, mdiRepeatOnce, mdiSpeaker, mdiDotsVertical,
} from '@mdi/js';

const props = defineProps({
  card: { type: Object, required: true },
});

const ma = useMusicAssistant(
  props.card.ma_url || 'http://192.168.0.20:8095',
  props.card.ma_token || '',
);

// ── Dialog ─────────────────────────────────────────────────────────────────
const dialogOpen = ref(false);

// ── Player selection ───────────────────────────────────────────────────────
// Only show "real" players (not protocol-only sub-players)
const visiblePlayers = computed(() =>
  ma.players.value.filter(p => p.enabled),
);

const selectedPlayerId = ref('');

// Auto-select: use configured player_id if set, else prefer a playing player
// Also re-run when props.card.player_id changes (user picked a different player in edit dialog)
watch([visiblePlayers, () => props.card.player_id], ([ps]) => {
  if (!ps.length) return;
  const pinned = props.card.player_id && ps.find(p => p.player_id === props.card.player_id);
  if (pinned) {
    selectedPlayerId.value = pinned.player_id;
  } else if (!selectedPlayerId.value) {
    const playing = ps.find(p => p.state === 'playing');
    selectedPlayerId.value = (playing ?? ps[0]).player_id;
  }
}, { immediate: true });

const activePlayerId = computed(() => selectedPlayerId.value);
const activePlayer   = computed(() => ma.players.value.find(p => p.player_id === activePlayerId.value));
const activeQueue    = computed(() => ma.queues.value[activePlayerId.value]);

const isPlaying = computed(() => activePlayer.value?.state === 'playing');

// ── Current track ──────────────────────────────────────────────────────────
const currentTrack = computed(() => activeQueue.value?.current_item?.media_item ?? activeQueue.value?.current_item);
const artist = computed(() => {
  const t = currentTrack.value;
  if (!t) return '';
  if (t.artists?.length) return t.artists.map(a => a.name).join(', ');
  return t.artist_str ?? '';
});
const album = computed(() => currentTrack.value?.album?.name ?? '');

const elapsed  = computed(() => activeQueue.value?.elapsed_time ?? 0);
const duration = computed(() => currentTrack.value?.duration ?? activeQueue.value?.current_item?.duration ?? 0);

// ── Local progress ticker ──────────────────────────────────────────────────
const localElapsed = ref(0);
let ticker = null;

// Sync from server whenever queue_time_updated arrives
watch(elapsed, (v) => { localElapsed.value = v; }, { immediate: true });

// Tick every second while playing
watch(isPlaying, (playing) => {
  clearInterval(ticker);
  if (playing) {
    ticker = setInterval(() => {
      localElapsed.value = Math.min(localElapsed.value + 1, duration.value || Infinity);
    }, 1000);
  }
}, { immediate: true });

onUnmounted(() => clearInterval(ticker));

const progressPct = computed(() => duration.value ? Math.min(100, (localElapsed.value / duration.value) * 100) : 0);

// ── Album art ──────────────────────────────────────────────────────────────
const maArtUrl = computed(() => {
  const item = currentTrack.value;
  if (!item) return '';
  const base = (props.card.ma_url || 'http://192.168.0.20:8095').replace(/\/$/, '');
  const imgObj = item.metadata?.images?.[0] || item.album?.metadata?.images?.[0];
  if (!imgObj?.path) return '';
  return `${base}/imageproxy?path=${encodeURIComponent(encodeURIComponent(imgObj.path))}&provider=${encodeURIComponent(imgObj.provider)}&checksum=&size=256`;
});

// Route through dashboard proxy so canvas can read pixels (same-origin)
const artUrl = computed(() =>
  maArtUrl.value ? `/api/imageproxy?url=${encodeURIComponent(maArtUrl.value)}` : ''
);

// ── Shuffle / Repeat ───────────────────────────────────────────────────────
const shuffleEnabled = computed(() => activeQueue.value?.shuffle_enabled ?? false);
const repeatMode     = computed(() => activeQueue.value?.repeat_mode ?? 'off');

function toggleShuffle() { ma.setShuffle(activePlayerId.value, !shuffleEnabled.value); }
function cycleRepeat() {
  const modes = ['off', 'all', 'one'];
  const next = modes[(modes.indexOf(repeatMode.value) + 1) % modes.length];
  ma.setRepeat(activePlayerId.value, next);
}

// ── Seek ───────────────────────────────────────────────────────────────────
function onSeek(e) {
  if (!duration.value) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  localElapsed.value = pct * duration.value;
  ma.seek(activePlayerId.value, pct * duration.value);
}

// ── Color palette (WCAG-based) ─────────────────────────────────────────────
const accentBg = ref('');
const accentFg = ref('#e8eaf0');

function srgbLum(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function relativeLuminance([r, g, b]) {
  return 0.2126 * srgbLum(r) + 0.7152 * srgbLum(g) + 0.0722 * srgbLum(b);
}
function contrastRatio(l1, l2) {
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function extractPalette(url, count = 6) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 64;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      try {
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
        const STEP = 8;
        const buckets = new Map();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const r = Math.round(data[i]   / STEP) * STEP;
          const g = Math.round(data[i+1] / STEP) * STEP;
          const b = Math.round(data[i+2] / STEP) * STEP;
          const key = (r << 16) | (g << 8) | b;
          buckets.set(key, (buckets.get(key) || 0) + 1);
        }
        const top = [...buckets.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, count)
          .map(([key]) => [(key >> 16) & 255, (key >> 8) & 255, key & 255]);
        resolve(top);
      } catch { resolve([]); }
    };
    img.onerror = () => resolve([]);
    img.src = url;
  });
}

function extractVividHue(data) {
  const BUCKETS = 36;
  const hueWeights = new Float32Array(BUCKETS);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    if (l < 0.06 || l > 0.94 || d < 0.1) continue;
    const s = d / (1 - Math.abs(2 * l - 1));
    if (s < 0.15) continue;
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    hueWeights[Math.floor((h / 6) * BUCKETS) % BUCKETS] += s * s;
  }
  const total = hueWeights.reduce((a, b) => a + b, 0);
  if (!total) return -1;
  const smoothed = hueWeights.map((v, i) =>
    v * 0.5 + hueWeights[(i + 1) % BUCKETS] * 0.25 + hueWeights[(i - 1 + BUCKETS) % BUCKETS] * 0.25
  );
  return Math.round((smoothed.indexOf(Math.max(...smoothed)) / BUCKETS) * 360);
}

async function updateColors(url) {
  if (!url) { accentBg.value = ''; accentFg.value = '#e8eaf0'; return; }
  const SIZE = 64;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  await new Promise(r => { img.onload = r; img.onerror = r; img.src = url; });
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  let data;
  try { data = ctx.getImageData(0, 0, SIZE, SIZE).data; } catch { return; }

  const palette = await extractPalette(url);
  let bestBg = null, bestBgContrast = 0;
  for (const rgb of palette) {
    const cr = contrastRatio(1, relativeLuminance(rgb));
    if (cr > bestBgContrast) { bestBgContrast = cr; bestBg = rgb; }
  }
  accentBg.value = bestBg ? rgbToHex(bestBg) : '';

  const hue = extractVividHue(data);
  accentFg.value = hue >= 0 ? `hsl(${hue}, 80%, 65%)` : '#e8eaf0';
}

watch(artUrl, url => updateColors(url), { immediate: true });

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtTime(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
</script>

<style scoped>
.ma-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  overflow: hidden;
  position: relative;
}

.ma-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.82rem;
  color: var(--text-muted);
}
.ma-error { color: var(--accent-red); }

.ma-bg-art {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: auto;
  object-fit: cover;
  z-index: 0;
  pointer-events: none;
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 15%);
  mask-image: linear-gradient(to right, transparent 0%, black 15%);
}


.ma-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  position: relative;
  z-index: 2;
  padding-left: 3px;
}

.ma-track {
  font-size: 1.15rem;
  font-weight: 400;
  color: #e8eaf0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ma-artist {
  font-size: 1.17rem;
  color: #e8eaf0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ma-album {
  font-size: 1.08rem;
  color: #e8eaf0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Progress ── */
.ma-progress-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.4rem;
}

.ma-time {
  font-size: 0.65rem;
  color: #e8eaf0;
  min-width: 28px;
}

.ma-time--remaining {
  text-align: right;
}

.ma-progress-track {
  flex: 1;
  height: 3px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
}

.ma-progress-fill {
  height: 100%;
  background: #e8eaf0;
  border-radius: 2px;
  transition: width 0.5s linear;
}

/* ── Controls ── */
.ma-controls {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.ma-btns {
  display: flex;
  align-items: center;
  gap: 0;
}

.ma-btn {
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #e8eaf0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem;
  transition: opacity 0.15s;
}
.ma-btn svg { width: 20px; height: 20px; }
.ma-btn:hover { opacity: 0.75; }

.ma-btn-play {
  padding: 0.2rem;
}
.ma-btn-play svg { width: 22px; height: 22px; }

.ma-btn-sm svg { width: 16px; height: 16px; }
.ma-btn-sm { padding: 0.3rem; margin-left: auto; }
.ma-btn-sm:first-of-type { margin-left: auto; }
.ma-btn-sm.active { opacity: 1; color: #fff; }


/* ── Foreground content above bg art ── */
.ma-player-name,
.ma-controls {
  position: relative;
  z-index: 2;
}

/* ── Player name ── */
.ma-player-name {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #e8eaf0;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ma-player-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  color: #e8eaf0;
}

.ma-dots-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: #e8eaf0;
  cursor: pointer;
  padding: 0.1rem;
  display: flex;
  align-items: center;
  opacity: 0.6;
  flex-shrink: 0;
}
.ma-dots-btn:hover { opacity: 1; }
.ma-dots-btn svg { width: 16px; height: 16px; }
</style>
