<template>
  <!-- Desktop: fixed overlay. Mobile (fullpage prop): fills its container -->
  <Teleport v-if="!fullpage" to="body">
    <div class="overlay-backdrop" @click.self="$emit('close')">
      <div class="overlay-panel">
        <button class="close-btn" @click="$emit('close')">✕</button>
        <div class="device-title">{{ device.name }}</div>
        <component :is="remoteComponent" :device="device" @send="sendCommand" />
      </div>
    </div>
  </Teleport>
  <div v-else class="fullpage-panel">
    <button class="back-btn" @click="$emit('close')">← Back</button>
    <div class="device-title">{{ device.name }}</div>
    <component :is="remoteComponent" :device="device" @send="sendCommand" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useMqtt } from '../composables/useMqtt.js';
import PhilipsTvRemote from './remotes/PhilipsTvRemote.vue';
import LgTvRemote from './remotes/LgTvRemote.vue';
import SoundbarRemote from './remotes/SoundbarRemote.vue';
import AppleTvRemote from './remotes/AppleTvRemote.vue';

const props = defineProps({
  device:   { type: Object,  required: true },
  fullpage: { type: Boolean, default: false },
});
defineEmits(['close']);

const { publish } = useMqtt();

const remoteComponent = computed(() => {
  switch (props.device.type) {
    case 'lg_tv':    return LgTvRemote;
    case 'soundbar': return SoundbarRemote;
    case 'apple_tv': return AppleTvRemote;
    default:         return PhilipsTvRemote;
  }
});

function sendCommand(cmdKey) {
  if (props.device.type === 'apple_tv') {
    const cmd = props.device.commands?.[cmdKey];
    if (!cmd || !props.device.atv_id) return;
    publish(`appletv/${props.device.atv_id}/command`, cmd);
    return;
  }
  const code = props.device.commands?.[cmdKey];
  if (!code || !props.device.transmitter_id) return;
  publish(`ir/${props.device.transmitter_id}/transmit`, JSON.stringify(code));
}
</script>

<style scoped>
.overlay-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex; align-items: center; justify-content: center;
  z-index: 500;
}
.overlay-panel {
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  position: relative;
}
.close-btn {
  background: none; border: none; color: #666;
  font-size: 1rem; cursor: pointer; padding: 0.2rem 0.4rem;
  border-radius: 4px; transition: color 0.15s;
}
.close-btn:hover { color: #aaa; }

.fullpage-panel {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.75rem; padding: 1rem 1rem 2rem; width: 100%; box-sizing: border-box;
  background: #000; min-height: 100%;
}
.back-btn {
  align-self: flex-start;
  background: none; border: 1px solid #2e2e3a; border-radius: 6px;
  color: #666; font-size: 0.8rem; font-family: inherit;
  padding: 0.35rem 0.75rem; cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.back-btn:hover { color: #aaa; border-color: #555; }
.device-title {
  font-size: 0.8rem; font-weight: 700; letter-spacing: 0.15em;
  text-transform: uppercase; color: #555;
}
</style>
