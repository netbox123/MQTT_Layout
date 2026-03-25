<template>
  <Teleport to="body">
    <Transition name="sound-hint">
      <div v-if="!audioUnlocked" class="sound-hint" @click="ensureAudioCtx">🔔 Click to enable sounds</div>
    </Transition>
    <Transition name="notif-overlay">
      <div v-if="active" class="notif-overlay">
        <div class="notif-box" :class="`notif-box--${active.level || 'info'}`">

          <div class="notif-box-header">
            <span class="notif-box-level-dot"></span>
            <span class="notif-box-title">{{ active.title }}</span>
          </div>

          <div v-if="active.message" class="notif-box-message">{{ active.message }}</div>

          <div class="notif-box-footer">
            <div class="notif-box-sound-status">{{ soundStatus }}</div>
            <button class="notif-box-cancel" @click="cancel">Cancel</button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { useNotificationStore } from '../stores/notificationStore.js';
import { getMaInstances } from '../composables/useMusicAssistant.js';

const store  = useNotificationStore();
const active = ref(null);
const soundStatus = ref('');

let cancelFn = null;

// Unlock AudioContext on first user gesture so MQTT-triggered sounds can play
let audioCtx = null;
const audioUnlocked = ref(false);
function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  audioUnlocked.value = true;
  return audioCtx;
}
document.addEventListener('click',    ensureAudioCtx, { once: false, passive: true });
document.addEventListener('touchend', ensureAudioCtx, { once: false, passive: true });

async function playSound(path) {
  const ctx = audioCtx;
  if (!ctx || ctx.state === 'suspended') {
    return new Promise(resolve => {
      const audio = new Audio(path);
      audio.onended = resolve;
      audio.onerror = resolve;
      audio.play().catch(resolve);
      const prev = cancelFn;
      cancelFn = () => { audio.pause(); prev?.(); resolve(); };
    });
  }
  try {
    const res     = await fetch(path);
    const buf     = await res.arrayBuffer();
    const decoded = await ctx.decodeAudioData(buf);
    return new Promise(resolve => {
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      src.onended = resolve;
      src.start();
      const prev = cancelFn;
      cancelFn = () => { try { src.stop(); } catch {} prev?.(); resolve(); };
    });
  } catch {
    return Promise.resolve();
  }
}

function wait(ms) {
  return new Promise(resolve => {
    const t = setTimeout(resolve, ms);
    const prev = cancelFn;
    cancelFn = () => { clearTimeout(t); prev?.(); resolve(); };
  });
}

async function runSequence(n) {
  cancelFn = null;

  // Auto-dismiss after 1 minute regardless of sounds
  const autoTimer = setTimeout(() => dismiss(), 60_000);
  const prevCancel = cancelFn;
  cancelFn = () => { clearTimeout(autoTimer); prevCancel?.(); };

  if (n.sound1) {
    soundStatus.value = '♪ ' + n.sound1.replace(/\.[^.]+$/, '');
    await playSound(`/sounds/alert_sounds/${n.sound1}`);
  }

  if (n.sound2) {
    soundStatus.value = '♪ ' + n.sound2.replace(/\.[^.]+$/, '');
    await playSound(`/sounds/speech_sounds/${n.sound2}`);
  }

  // Push announcement to all currently-playing MA players
  const base = store.announcementBase || window.location.origin;
  const maList = getMaInstances().filter(ma => ma.authed.value);
  for (const ma of maList) {
    const playing = ma.players.value.filter(p => p.state === 'playing');
    for (const player of playing) {
      try {
        if (n.sound1) await ma.playAnnouncement(player.player_id, `${base}/sounds/alert_sounds/${n.sound1}`);
        if (n.sound2) await ma.playAnnouncement(player.player_id, `${base}/sounds/speech_sounds/${n.sound2}`);
      } catch { /* ignore if player unavailable */ }
    }
  }

  // Keep overlay visible for at least 8 seconds regardless of sound duration
  await wait(8000);

  clearTimeout(autoTimer);
  soundStatus.value = '';
  dismiss();
}

function dismiss() {
  active.value = null;
  store.clearActive();
  cancelFn = null;
}

function cancel() {
  cancelFn?.();
  dismiss();
}

watch(() => store.activeNotification, async (n) => {
  if (!n) return;
  cancelFn?.();
  active.value = n;
  soundStatus.value = '';
  await nextTick();   // ensure overlay renders before sounds start
  runSequence(n);
});
</script>

<style scoped>
.notif-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.notif-box {
  pointer-events: all;
  background: #1e2540;
  border-radius: 12px;
  border: 2px solid #3d4870;
  padding: 1.5rem 1.75rem;
  width: min(420px, 90vw);
  box-shadow: 0 8px 40px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.notif-box--info    { border-color: #3b82f6; }
.notif-box--success { border-color: #22c55e; }
.notif-box--warning { border-color: #f59e0b; }
.notif-box--error   { border-color: #ef4444; }

.notif-box-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.notif-box-level-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #3b82f6;
}
.notif-box--info    .notif-box-level-dot { background: #3b82f6; }
.notif-box--success .notif-box-level-dot { background: #22c55e; }
.notif-box--warning .notif-box-level-dot { background: #f59e0b; }
.notif-box--error   .notif-box-level-dot { background: #ef4444; }

.notif-box-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #e8eaf0;
}

.notif-box-message {
  font-size: 0.95rem;
  color: #9aa3bc;
  line-height: 1.5;
}

.notif-box-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.25rem;
}

.notif-box-sound-status {
  font-size: 0.78rem;
  color: #6b7499;
  font-style: italic;
}

.notif-box-cancel {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 6px;
  color: #9aa3bc;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.4rem 1.1rem;
  cursor: pointer;
}
.notif-box-cancel:hover { background: #313858; color: #e8eaf0; }

/* ── Sound hint ── */
.sound-hint {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  background: #1e2540;
  border: 1px solid #3d4870;
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  font-size: 0.78rem;
  color: #9aa3bc;
  cursor: pointer;
  z-index: 9998;
  pointer-events: all;
}
.sound-hint:hover { color: #e8eaf0; border-color: var(--accent-blue); }
.sound-hint-enter-active, .sound-hint-leave-active { transition: opacity 0.3s; }
.sound-hint-enter-from, .sound-hint-leave-to { opacity: 0; }

/* ── Transitions ── */
.notif-overlay-enter-active { transition: opacity 0.2s, transform 0.2s; }
.notif-overlay-leave-active { transition: opacity 0.2s, transform 0.15s; }
.notif-overlay-enter-from  { opacity: 0; transform: scale(0.92); }
.notif-overlay-leave-to    { opacity: 0; transform: scale(0.95); }
</style>
