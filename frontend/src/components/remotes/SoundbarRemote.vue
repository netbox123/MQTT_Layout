<template>
  <div class="remote remote--soundbar">
    <div class="r-brand">SOUNDBAR</div>
    <button class="rkey rkey--power" @click="$emit('send', 'power')" title="Power">⏻</button>
    <div class="r-vol">
      <button class="rkey rkey--vol" @click="$emit('send', 'vol_up')" title="Volume Up">V+</button>
      <button class="rkey rkey--mute" @click="$emit('send', 'mute')" title="Mute">🔇</button>
      <button class="rkey rkey--vol" @click="$emit('send', 'vol_down')" title="Volume Down">V-</button>
    </div>
  </div>
</template>

<script setup>
defineEmits(['send']);
</script>

<style scoped>
@import './remote-shared.css';
.remote--soundbar { gap: 1.5rem; }
.r-brand { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.15em; color: var(--text-muted); }
.r-vol { display: flex; gap: 0.6rem; align-items: center; }
.rkey--vol  { width: 52px; height: 52px; font-size: 0.85rem; }
.rkey--mute { width: 44px; height: 44px; font-size: 1rem; background: #1e2840; }
</style>
