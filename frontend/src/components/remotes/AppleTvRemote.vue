<template>
  <div class="remote remote--appletv">
    <div class="r-brand">APPLE TV</div>

    <div class="r-row3">
      <button class="rkey rkey--power" @click="$emit('send', 'turn_on')"  title="Power On">⏻</button>
      <span></span>
      <button class="rkey rkey--power rkey--off" @click="$emit('send', 'turn_off')" title="Power Off">⏻</button>
    </div>

    <div class="r-row3">
      <button class="rkey rkey--fn" @click="$emit('send', 'volume_down')" title="Volume Down">V−</button>
      <span></span>
      <button class="rkey rkey--fn" @click="$emit('send', 'volume_up')"   title="Volume Up">V+</button>
    </div>

    <div class="r-divider"></div>

    <div class="r-dpad">
      <span></span>
      <button class="rkey r-arrow" @click="$emit('send', 'up')"    title="Up">▲</button>
      <span></span>
      <button class="rkey r-arrow" @click="$emit('send', 'left')"  title="Left">◀</button>
      <button class="rkey r-ok"    @click="$emit('send', 'select')" title="Select">OK</button>
      <button class="rkey r-arrow" @click="$emit('send', 'right')" title="Right">▶</button>
      <span></span>
      <button class="rkey r-arrow" @click="$emit('send', 'down')"  title="Down">▼</button>
      <span></span>
    </div>

    <div class="r-row3">
      <button class="rkey rkey--fn" @click="$emit('send', 'menu')"     title="Back">Back</button>
      <button class="rkey rkey--home" @click="$emit('send', 'home')"   title="Home">⌂</button>
      <button class="rkey rkey--fn" @click="$emit('send', 'top_menu')" title="Top Menu">☰</button>
    </div>

    <div class="r-divider"></div>

    <div class="r-row3">
      <button class="rkey rkey--fn" @click="$emit('send', 'previous')"  title="Previous">⏮</button>
      <button class="rkey rkey--fn" @click="$emit('send', 'play_pause')" title="Play/Pause">⏯</button>
      <button class="rkey rkey--fn" @click="$emit('send', 'next')"      title="Next">⏭</button>
    </div>

    <div class="r-row3">
      <button class="rkey rkey--fn" @click="$emit('send', 'skip_backward')" title="Skip Back">«</button>
      <span></span>
      <button class="rkey rkey--fn" @click="$emit('send', 'skip_forward')"  title="Skip Forward">»</button>
    </div>

    <slot />
  </div>
</template>

<script setup>
defineEmits(['send']);
</script>

<style scoped>
@import './remote-shared.css';

.remote--appletv { gap: 10px; padding-top: 22px; padding-bottom: 22px; }

.rkey--off {
  background: #1a1a1e;
  border-color: #333;
  color: #666;
}
.rkey--off:hover { background: #252528; color: #999; }
</style>
