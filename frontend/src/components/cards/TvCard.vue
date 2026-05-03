<template>
  <div class="card tv-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiTelevision" /></svg>
      {{ card.title || 'TVs' }}
    </div>
    <div v-if="!devices.length" class="empty-msg">No data yet</div>
    <div v-else class="device-list">
      <div v-for="d in devices" :key="d.id" class="device-row">
        <span class="dot" :class="d.online ? 'dot--on' : 'dot--off'"></span>
        <span class="device-name">{{ d.name }}</span>
        <button class="action-btn action-btn--remote" title="Open Remote" :disabled="!d.online" @click.stop="remoteFor = d">Remote</button>
        <button class="action-btn action-btn--wake" title="Wake / Power On" :disabled="d.online" @click.stop="wake(d.id)">Wake</button>
        <button class="action-btn action-btn--off" title="Power Off" :disabled="!d.online" @click.stop="poweroff(d.id)">Off</button>
      </div>
    </div>
  </div>

  <!-- Philips Remote modal -->
  <Teleport to="body">
    <div v-if="remoteFor" class="remote-overlay" @click.self="remoteFor = null">
      <div class="remote-wrap">

        <div class="remote-label">
          <span>{{ remoteFor.name }}</span>
          <button class="remote-close" @click="remoteFor = null">✕</button>
        </div>

        <div class="remote-shell">

          <div class="r-brand">PHILIPS</div>

          <div class="r-center">
            <button class="rkey rkey--power" title="Power / Standby" @click="sendKey('Standby')">⏻</button>
          </div>

          <div class="r-row3">
            <button class="rkey" title="Previous"     @click="sendKey('Previous')">⏮</button>
            <button class="rkey" title="Play / Pause" @click="sendKey('Play')">⏯</button>
            <button class="rkey" title="Next"         @click="sendKey('Next')">⏭</button>
          </div>

          <div class="r-row3">
            <button class="rkey" title="Rewind"       @click="sendKey('Rewind')">⏪</button>
            <button class="rkey" title="Stop"         @click="sendKey('Stop')">⏹</button>
            <button class="rkey" title="Fast Forward" @click="sendKey('FastForward')">⏩</button>
          </div>

          <div class="r-divider"></div>

          <div class="r-dpad-group">
            <div class="r-row3">
              <button class="rkey rkey--fn" title="Source / Inputs" @click="sendKey('Source')">SRC</button>
              <span></span>
              <button class="rkey" title="Info" @click="sendKey('Info')">ℹ</button>
            </div>
            <div class="r-dpad">
              <span></span>
              <button class="rkey r-arrow" @click="sendKey('CursorUp')">▲</button>
              <span></span>
              <button class="rkey r-arrow" @click="sendKey('CursorLeft')">◀</button>
              <button class="rkey r-ok"   @click="sendKey('Confirm')">OK</button>
              <button class="rkey r-arrow" @click="sendKey('CursorRight')">▶</button>
              <span></span>
              <button class="rkey r-arrow" @click="sendKey('CursorDown')">▼</button>
              <span></span>
            </div>
          </div>

          <div class="r-block r-block--overlap">
            <div class="r-row3">
              <button class="rkey rkey--fn" title="Back" @click="sendKey('Back')">◁ BACK</button>
              <span></span>
              <button class="rkey rkey--fn" title="List" @click="sendKey('Options')">LIST</button>
            </div>
            <div class="r-row3">
              <button class="rkey" title="Volume Down" @click="sendKey('VolumeDown')">V-</button>
              <button class="rkey rkey--home" title="Home" @click="sendKey('Home')"><span class="home-icon">⌂</span></button>
              <button class="rkey" title="Volume Up" @click="sendKey('VolumeUp')">V+</button>
            </div>
          </div>

          <div class="r-divider"></div>
          <div class="r-divider"></div>

          <div class="r-colors">
            <button class="rkey rkey--red"    @click="sendKey('RedColour')"></button>
            <button class="rkey rkey--green"  @click="sendKey('GreenColour')"></button>
            <button class="rkey rkey--yellow" @click="sendKey('YellowColour')"></button>
            <button class="rkey rkey--blue"   @click="sendKey('BlueColour')"></button>
          </div>

        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
export const icon = '📺';
</script>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { mdiTelevision } from '@mdi/js';
import { useMqttStore } from '../../stores/mqttStore.js';
import { useMqtt } from '../../composables/useMqtt.js';

const props = defineProps({
  card: { type: Object, required: true },
});

const mqttStore = useMqttStore();
const { publish } = useMqtt();

const prefix    = computed(() => props.card.mqtt_prefix || 'site_dashboard/tvs');
const remoteFor = ref(null);

const devices = computed(() => {
  const result = [];
  const pfx = prefix.value;
  for (const [topic, value] of Object.entries(mqttStore.topicValues)) {
    if (!topic.startsWith(pfx + '/') || !topic.endsWith('/state')) continue;
    const id = topic.slice(pfx.length + 1, -'/state'.length);
    if (!id || id.includes('/')) continue;
    let state = null;
    try { state = JSON.parse(value); } catch { /* raw value */ }
    const onlineRaw = mqttStore.topicValues[`${pfx}/${id}/online`];
    result.push({
      id,
      name: state?.name ?? id,
      ip: state?.ip ?? '',
      online: onlineRaw === 'ON' || onlineRaw === true,
    });
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  const ids = props.card.included_ids;
  return ids?.length ? result.filter(d => ids.includes(d.id)) : result;
});

function wake(id)     { publish(`${prefix.value}/${id}/command`, 'wake'); }
function poweroff(id) { publish(`${prefix.value}/${id}/command`, 'poweroff'); }
function sendKey(key) {
  if (!remoteFor.value) return;
  publish(`${prefix.value}/${remoteFor.value.id}/command`, `key:${key}`);
}

const KEY_MAP = {
  ArrowUp:    'CursorUp',
  ArrowDown:  'CursorDown',
  ArrowLeft:  'CursorLeft',
  ArrowRight: 'CursorRight',
  Enter:      'Confirm',
  '0': 'Digit0', '1': 'Digit1', '2': 'Digit2',
  '3': 'Digit3', '4': 'Digit4', '5': 'Digit5',
  '6': 'Digit6', '7': 'Digit7', '8': 'Digit8', '9': 'Digit9',
};

function onKeydown(e) {
  if (e.key === 'Escape') { remoteFor.value = null; return; }
  if (!remoteFor.value) return;
  const key = KEY_MAP[e.key];
  if (key) { e.preventDefault(); sendKey(key); }
}

onMounted(()   => document.addEventListener('keydown', onKeydown));
onUnmounted(() => document.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.tv-card {
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

.header-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.empty-msg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: #9aa3bc;
}

.device-list {
  flex: 1;
  overflow-y: auto;
  margin: 0 -0.65rem;
}

.device-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.22rem 0.65rem;
  white-space: nowrap;
  overflow: hidden;
}

.device-row:hover {
  background: var(--bg-card-hover);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot--on  { background: #4caf6e; }
.dot--off { background: #e05454; }

.device-name {
  flex: 1;
  font-size: 0.8rem;
  color: #e8eaf0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-btn {
  font-size: 0.65rem;
  font-family: inherit;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: #e8eaf0;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  line-height: 1.4;
}

.action-btn--remote:not(:disabled):hover { border-color: #5090d0; color: #5090d0; }
.action-btn--wake:not(:disabled):hover   { border-color: #4caf6e; color: #4caf6e; }
.action-btn--off:not(:disabled):hover    { border-color: #e05454; color: #e05454; }
.action-btn:disabled { color: var(--text-secondary); cursor: default; }

/* ── Remote overlay ── */

.remote-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.80);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remote-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  max-height: 95vh;
  overflow-y: auto;
  padding: 1rem;
  scrollbar-width: none;
}
.remote-wrap::-webkit-scrollbar { display: none; }

.remote-label {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.remote-close {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  line-height: 1;
}
.remote-close:hover { color: var(--text-primary); background: var(--bg-card); }

.remote-shell {
  width: 216px;
  background: #18181c;
  border-radius: 28px 28px 22px 22px;
  padding: 16px 16px 22px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.06),
    inset 0 -2px 0 rgba(0,0,0,0.5),
    0 24px 64px rgba(0,0,0,0.9),
    0 0 0 1px #2a2a32;
}

.rkey {
  background: #252528;
  border: 1px solid #38383e;
  border-bottom: 2px solid #111;
  border-radius: 8px;
  color: #bbb;
  font-size: 0.8rem;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  height: 34px;
  width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  user-select: none;
  transition: background 0.08s, color 0.08s;
}

.rkey:hover  { background: #2e2e34; color: #ddd; }
.rkey:active { background: #1a1a1e; border-bottom-width: 1px; transform: translateY(1px); color: #fff; }

.r-brand {
  text-align: center;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: #3a3a48;
  margin-bottom: -4px;
}

.r-center { display: flex; justify-content: center; }

.rkey--power {
  width: 44px; height: 44px;
  border-radius: 50%;
  background: #2a1015;
  border-color: #5c1a24;
  border-bottom-color: #1a080c;
  color: #e05060;
  font-size: 1.1rem;
}
.rkey--power:hover { background: #3a1520; color: #ff6070; }

.r-row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.r-row3 .rkey { width: 100%; }
.r-dpad-group { display: flex; flex-direction: column; }
.r-dpad-group .r-dpad { margin-top: -17px; }
.r-block { display: flex; flex-direction: column; gap: 6px; }
.r-block--overlap { margin-top: -26px; }

.r-divider {
  height: 1px;
  background: linear-gradient(to right, transparent, #2e2e3a, transparent);
  margin: -1px 0;
}

.rkey--fn {
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  font-weight: 700;
  color: #999;
}

.rkey--home { font-size: 1.6rem; }
.home-icon { display: inline-block; transform: translateY(-3px); }

.r-dpad {
  display: grid;
  grid-template-columns: repeat(3, 44px);
  gap: 4px;
  justify-content: center;
  align-items: center;
}

.r-dpad span { display: block; height: 34px; }

.r-arrow { height: 34px; font-size: 0.65rem; }

.r-ok {
  width: 44px; height: 44px;
  border-radius: 50% !important;
  background: #1c2638;
  border-color: #2a5090;
  border-bottom-color: #0e1830;
  color: #5090d0;
  font-weight: 700;
  font-size: 0.72rem;
}
.r-ok:hover { background: #223348; color: #60a8e8; }

.r-colors { display: flex; justify-content: space-around; align-items: center; }

.rkey--red    { width: 34px; height: 16px; border-radius: 8px; background: #7a1515; border-color: #9a2020; border-bottom-color: #4a0c0c; font-size: 0; }
.rkey--green  { width: 34px; height: 16px; border-radius: 8px; background: #156015; border-color: #207820; border-bottom-color: #0c3a0c; font-size: 0; }
.rkey--yellow { width: 34px; height: 16px; border-radius: 8px; background: #706010; border-color: #887818; border-bottom-color: #403808; font-size: 0; }
.rkey--blue   { width: 34px; height: 16px; border-radius: 8px; background: #151578; border-color: #201898; border-bottom-color: #0c0c48; font-size: 0; }

.rkey--red:hover    { background: #9a1e1e; }
.rkey--green:hover  { background: #1e781e; }
.rkey--yellow:hover { background: #887818; }
.rkey--blue:hover   { background: #201898; }
</style>
