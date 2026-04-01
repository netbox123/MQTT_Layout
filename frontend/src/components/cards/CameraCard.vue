<template>
  <div class="card camera-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiCctv" /></svg>
      {{ card.title }}
    </div>
    <div class="camera-body" @click="!props.mobile && (expanded = true)">
      <img
        v-if="(useSnapshot ? snapshotSrc : streamSrc) && !streamError"
        :key="streamKey"
        :src="useSnapshot ? snapshotSrc : streamSrc"
        class="camera-feed"
        alt="camera stream"
        @error="onStreamError"
      />
      <div v-if="streamError" class="camera-error">Stream unavailable</div>
      <div v-if="!card.stream_url" class="camera-error">No stream URL configured</div>
      <div v-if="!props.mobile && streamSrc && !streamError" class="expand-hint">
        <svg viewBox="0 0 24 24" fill="currentColor" class="expand-icon"><path :d="mdiFullscreen" /></svg>
      </div>
    </div>
  </div>

  <!-- Fullscreen dialog -->
  <Teleport to="body">
    <div v-if="expanded" class="cam-backdrop" @click.self="expanded = false">
      <div class="cam-dialog">
        <div class="cam-dialog-header">
          <span class="cam-dialog-title">
            <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiCctv" /></svg>
            {{ card.title }}
          </span>
          <button class="cam-close-btn" @click="expanded = false">
            <svg viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose" /></svg>
          </button>
        </div>
        <div class="cam-dialog-body">
          <img v-if="useSnapshot ? snapshotSrc : streamSrc" :src="useSnapshot ? snapshotSrc : streamSrc" class="cam-dialog-feed" alt="camera stream" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
export const icon = '📷';
</script>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { mdiCctv, mdiFullscreen, mdiClose } from '@mdi/js';

const props = defineProps({
  card: { type: Object, required: true },
  mobile: { type: Boolean, default: false },
});

const streamError = ref(false);
const expanded = ref(false);
const snapshotSrc = ref('');
const streamKey = ref(0);
let snapshotTimer = null;

const isRtsp = computed(() => /^rtsps?:\/\//i.test(props.card.stream_url ?? ''));
const useSnapshot = computed(() => props.mobile && isRtsp.value);

function refreshSnapshot() {
  const url = props.card.stream_url;
  if (!url) return;
  snapshotSrc.value = `/api/camera/snapshot?url=${encodeURIComponent(url)}&_t=${Date.now()}`;
}

function startPolling() {
  refreshSnapshot();
  snapshotTimer = setInterval(refreshSnapshot, 3000);
}

function stopPolling() {
  clearInterval(snapshotTimer);
  snapshotTimer = null;
}

let retryTimer = null;
function onStreamError() {
  streamError.value = true;
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    streamError.value = false;
    streamKey.value++;
  }, 5000);
}

function wakeStream() {
  streamError.value = false;
  streamKey.value++;
  if (useSnapshot.value) refreshSnapshot();
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') wakeStream();
}

function onDocClick() {
  if (streamError.value) wakeStream();
}

onMounted(() => {
  if (useSnapshot.value) startPolling();
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('click', onDocClick);
});
onUnmounted(() => {
  stopPolling();
  clearTimeout(retryTimer);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  document.removeEventListener('click', onDocClick);
});
watch(useSnapshot, (val) => { val ? startPolling() : stopPolling(); });

const streamSrc = computed(() => {
  const url = props.card.stream_url;
  if (!url) return null;
  return `/api/camera/stream?url=${encodeURIComponent(url)}&_t=${streamKey.value}`;
});
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card:hover { background: var(--bg-card-hover); }

.card-header {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: -10px;
}

.header-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.camera-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 4px;
  background: #000;
  min-height: 0;
  position: relative;
  cursor: pointer;
}

.camera-feed {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.expand-hint {
  position: absolute;
  bottom: 0.4rem;
  right: 0.4rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.camera-body:hover .expand-hint {
  opacity: 1;
}

.expand-icon {
  width: 18px;
  height: 18px;
  color: #fff;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));
}

.camera-error {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* ── Fullscreen dialog ── */
.cam-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.cam-dialog {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 75vw;
  height: 75vh;
  margin-bottom: 5vh;
  margin-right: 5vw;
}

.cam-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.cam-dialog-title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: #9aa3bc;
}

.cam-close-btn {
  background: none;
  border: none;
  color: #9aa3bc;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0.2rem;
  border-radius: 4px;
  transition: color 0.15s;
}

.cam-close-btn:hover { color: var(--text-primary); }
.cam-close-btn svg { width: 18px; height: 18px; }

.cam-dialog-body {
  flex: 1;
  display: flex;
  background: #000;
  min-height: 0;
}

.cam-dialog-feed {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
