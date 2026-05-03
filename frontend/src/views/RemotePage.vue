<template>
  <div class="remote-page">
    <button class="back-btn" @click="router.back()">← Back</button>
    <div v-if="!devices.length" class="remote-page__empty">No TVs found</div>
    <template v-else>
      <div v-if="devices.length > 1" class="device-selector">
        <button
          v-for="d in devices"
          :key="d.id"
          class="device-btn"
          :class="{ 'device-btn--active': selectedId === d.id, 'device-btn--offline': !d.online }"
          @click="selectedId = d.id"
        >
          <span class="dot" :class="d.online ? 'dot--on' : 'dot--off'"></span>
          {{ d.name }}
        </button>
      </div>

      <div v-if="!selected" class="remote-page__empty">No TV online</div>

      <div v-if="selected" class="remote-shell">

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
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMqttStore } from '../stores/mqttStore.js';
import { useMqtt } from '../composables/useMqtt.js';

const router = useRouter();

const PREFIX = 'site_dashboard/tvs';

const mqttStore = useMqttStore();
const { publish } = useMqtt();

const devices = computed(() => {
  const result = [];
  for (const [topic, value] of Object.entries(mqttStore.topicValues)) {
    if (!topic.startsWith(PREFIX + '/') || !topic.endsWith('/state')) continue;
    const id = topic.slice(PREFIX.length + 1, -'/state'.length);
    if (!id || id.includes('/')) continue;
    let state = null;
    try { state = JSON.parse(value); } catch { /* raw value */ }
    const onlineRaw = mqttStore.topicValues[`${PREFIX}/${id}/online`];
    result.push({
      id,
      name: state?.name ?? id,
      online: onlineRaw === 'ON' || onlineRaw === true,
    });
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
});

const selectedId = ref(null);

const selected = computed(() => {
  if (selectedId.value) return devices.value.find(d => d.id === selectedId.value && d.online) ?? null;
  return devices.value.find(d => d.online) ?? null;
});

function sendKey(key) {
  if (!selected.value) return;
  publish(`${PREFIX}/${selected.value.id}/command`, `key:${key}`);
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
  const key = KEY_MAP[e.key];
  if (key) { e.preventDefault(); sendKey(key); }
}

onMounted(()   => document.addEventListener('keydown', onKeydown));
onUnmounted(() => document.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.remote-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #000;
  margin: -0.75rem;
  padding: 2rem 1rem;
  box-sizing: border-box;
}

.back-btn {
  background: none;
  border: 1px solid #2e2e3a;
  border-radius: 6px;
  color: #666;
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  margin-bottom: 0.75rem;
}

.back-btn:hover {
  color: #aaa;
  border-color: #555;
}

.remote-page__empty {
  color: #555;
  font-size: 0.9rem;
}

.device-selector {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 1rem;
}

.device-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: #1a1a1e;
  border: 1px solid #2e2e3a;
  border-radius: 6px;
  color: #aaa;
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.device-btn--active {
  border-color: #5090d0;
  color: #5090d0;
}

.device-btn--offline {
  opacity: 0.45;
  cursor: default;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot--on  { background: #4caf6e; }
.dot--off { background: #e05454; }

.remote-label {
  color: #555;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 1rem;
}

.remote-shell {
  width: 270px;
  background: #18181c;
  border-radius: 35px 35px 28px 28px;
  padding: 20px 20px 28px;
  display: flex;
  flex-direction: column;
  gap: 11px;
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
  border-radius: 10px;
  color: #bbb;
  font-size: 1rem;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  height: 43px;
  width: 55px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  user-select: none;
  transition: background 0.08s, color 0.08s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.rkey:hover  { background: #2e2e34; color: #ddd; }
.rkey:active { background: #1a1a1e; border-bottom-width: 1px; transform: translateY(1px); color: #fff; }

.r-brand {
  text-align: center;
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: #3a3a48;
  margin-bottom: -4px;
}

.r-center { display: flex; justify-content: center; }

.rkey--power {
  width: 55px; height: 55px;
  border-radius: 50%;
  background: #2a1015;
  border-color: #5c1a24;
  border-bottom-color: #1a080c;
  color: #e05060;
  font-size: 1.4rem;
}
.rkey--power:hover { background: #3a1520; color: #ff6070; }

.r-row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.r-row3 .rkey { width: 100%; }
.r-dpad-group { display: flex; flex-direction: column; }
.r-dpad-group .r-dpad { margin-top: -21px; }
.r-block { display: flex; flex-direction: column; gap: 8px; }
.r-block--overlap { margin-top: -33px; }

.r-divider {
  height: 1px;
  background: linear-gradient(to right, transparent, #2e2e3a, transparent);
  margin: -1px 0;
}

.rkey--fn {
  font-size: 0.73rem;
  letter-spacing: 0.04em;
  font-weight: 700;
  color: #999;
}

.rkey--home { font-size: 2rem; }
.home-icon { display: inline-block; transform: translateY(-4px); }

.r-dpad {
  display: grid;
  grid-template-columns: repeat(3, 55px);
  gap: 5px;
  justify-content: center;
  align-items: center;
}

.r-dpad span { display: block; height: 43px; }

.r-arrow { height: 43px; font-size: 0.81rem; }

.r-ok {
  width: 55px; height: 55px;
  border-radius: 50% !important;
  background: #1c2638;
  border-color: #2a5090;
  border-bottom-color: #0e1830;
  color: #5090d0;
  font-weight: 700;
  font-size: 0.9rem;
}
.r-ok:hover { background: #223348; color: #60a8e8; }

.r-colors { display: flex; justify-content: space-around; align-items: center; }

.rkey--red    { width: 43px; height: 20px; border-radius: 10px; background: #7a1515; border-color: #9a2020; border-bottom-color: #4a0c0c; font-size: 0; }
.rkey--green  { width: 43px; height: 20px; border-radius: 10px; background: #156015; border-color: #207820; border-bottom-color: #0c3a0c; font-size: 0; }
.rkey--yellow { width: 43px; height: 20px; border-radius: 10px; background: #706010; border-color: #887818; border-bottom-color: #403808; font-size: 0; }
.rkey--blue   { width: 43px; height: 20px; border-radius: 10px; background: #151578; border-color: #201898; border-bottom-color: #0c0c48; font-size: 0; }

.rkey--red:hover    { background: #9a1e1e; }
.rkey--green:hover  { background: #1e781e; }
.rkey--yellow:hover { background: #887818; }
.rkey--blue:hover   { background: #201898; }
</style>
