<template>
  <div class="remote remote--soundbar">
    <div class="r-brand">SOUNDBAR</div>
    <div class="r-center">
      <button class="rkey rkey--power" @click="$emit('send', 'power')" title="Power">⏻</button>
    </div>
    <div class="r-row3">
      <button class="rkey rkey--vol" @click="$emit('send', 'vol_down')" title="Volume Down">V-</button>
      <button class="rkey rkey--mute" @click="$emit('send', 'mute')" title="Mute">🔇</button>
      <button class="rkey rkey--vol" @click="$emit('send', 'vol_up')" title="Volume Up">V+</button>
    </div>

    <slot />
  </div>
</template>

<script setup>
defineEmits(['send']);
</script>

<style scoped>
@import './remote-shared.css';
.remote--soundbar { gap: 1.25rem; padding-top: 22px; padding-bottom: 22px; }
.rkey--vol  { font-size: 0.9rem; font-weight: 700; height: 55px; }
.rkey--mute { font-size: 1.1rem; height: 55px; background: #1e2840; border-color: #2a4070; }
</style>
