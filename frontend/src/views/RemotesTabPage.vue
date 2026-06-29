<template>
  <div class="remotes-page" :class="{ 'remotes-page--embedded': embedded }">
    <div v-if="!remoteTypes.length" class="empty">No IR devices configured</div>
    <template v-else>
      <!-- Top: remote type tabs -->
      <div class="tab-bar tab-bar--top">
        <button
          v-for="rt in remoteTypes"
          :key="rt.type"
          class="tab-btn"
          :class="{ 'tab-btn--active': selectedType === rt.type }"
          @click="selectType(rt.type)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" class="tab-icon">
            <path :d="TYPE_ICONS[rt.type] ?? mdiTelevision" />
          </svg>
          {{ rt.name }}
        </button>
      </div>

      <!-- Middle: remote layout (receiver tabs injected via slot) -->
      <div class="remote-wrap">
        <component
          :is="remoteComponent(selectedType)"
          :device="activeReceiver"
          @send="sendCommand"
        >
          <div v-if="typeReceivers.length > 1" class="receiver-tabs">
            <button
              v-for="r in typeReceivers"
              :key="r.id"
              class="receiver-tab"
              :class="{ 'receiver-tab--active': activeReceiverId === r.id }"
              @click="activeReceiverId = r.id"
            >{{ r.name }}</button>
          </div>
        </component>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { mdiTelevision, mdiSpeaker } from '@mdi/js';
import { useMqtt } from '../composables/useMqtt.js';
import PhilipsTvRemote from '../components/remotes/PhilipsTvRemote.vue';
import LgTvRemote from '../components/remotes/LgTvRemote.vue';
import SoundbarRemote from '../components/remotes/SoundbarRemote.vue';

defineProps({
  pageConfig: { type: Object, default: () => ({}) },
  embedded:   { type: Boolean, default: false },
});

const { publish } = useMqtt();

const TYPE_ICONS = { soundbar: mdiSpeaker };

const remoteTypes  = ref([]);   // from /api/remotes — ordered list of types
const allReceivers = ref([]);   // from /api/all-receivers — all configured receivers

const selectedType     = ref(null);
const activeReceiverId = ref(null);

// Receivers that match the currently selected remote type
const typeReceivers = computed(() =>
  allReceivers.value.filter(r => r.type === selectedType.value)
);

const activeReceiver = computed(() =>
  typeReceivers.value.find(r => r.id === activeReceiverId.value) ?? null
);

// When type changes, auto-select first receiver of that type
watch(selectedType, () => {
  activeReceiverId.value = typeReceivers.value[0]?.id ?? null;
});

function selectType(type) {
  selectedType.value = type;
}

function remoteComponent(type) {
  if (type === 'lg_tv')    return LgTvRemote;
  if (type === 'soundbar') return SoundbarRemote;
  return PhilipsTvRemote;
}

function sendCommand(cmdKey) {
  if (!activeReceiver.value?.transmitter_id) return;
  const code = activeReceiver.value.commands?.[cmdKey];
  if (!code) return;
  publish(`ir/${activeReceiver.value.transmitter_id}/transmit`, JSON.stringify(code));
}

onMounted(async () => {
  const [typesRes, receiversRes] = await Promise.all([
    fetch('/api/remotes'),
    fetch('/api/all-receivers'),
  ]).catch(() => []);

  if (typesRes?.ok)     remoteTypes.value  = await typesRes.json();
  if (receiversRes?.ok) allReceivers.value = await receiversRes.json();

  if (remoteTypes.value.length) {
    selectedType.value = remoteTypes.value[0].type;
  }
});
</script>

<style scoped>
.remotes-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100dvh;
  background: #000;
  margin: -0.75rem;
  padding: env(safe-area-inset-top, 0.75rem) 0 env(safe-area-inset-bottom, 1rem);
  box-sizing: border-box;
}
.remotes-page--embedded {
  margin: 0;
  min-height: 0;
  flex: 1;
  padding: 0 0 1rem;
}

.empty {
  color: #555;
  font-size: 0.9rem;
  margin-top: 3rem;
}

.tab-bar {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  overflow-x: auto;
  width: 100%;
  box-sizing: border-box;
  scrollbar-width: none;
  flex-shrink: 0;
}
.tab-bar::-webkit-scrollbar { display: none; }

.tab-bar--top { border-bottom: 1px solid #1e1e28; }

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
  flex-shrink: 0;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.tab-btn:hover { color: #aaa; border-color: #444; }
.tab-btn--active {
  color: #5090d0;
  border-color: #5090d0;
  background: #0e1a2e;
}

.tab-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.remote-wrap {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 1rem;
  width: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  flex: 1;
}

.receiver-tabs {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  justify-content: center;
  padding-top: 0.25rem;
  border-top: 1px solid #2a2a32;
  margin-top: 4px;
}

.receiver-tab {
  background: #111115;
  border: 1px solid #2e2e3a;
  border-radius: 6px;
  color: #555;
  font-size: 0.72rem;
  font-family: inherit;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.receiver-tab:hover { color: #999; border-color: #444; }
.receiver-tab--active {
  color: #5090d0;
  border-color: #3a6aaa;
  background: #0a1525;
}
</style>
