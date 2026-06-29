<template>
  <div class="remote">
    <div class="r-brand">LG</div>

    <div class="r-center">
      <button class="rkey rkey--power" @click="$emit('send', 'power')" title="Power">⏻</button>
    </div>

    <div class="r-row3">
      <button class="rkey rkey--fn" @click="$emit('send', 'source')" title="Source">SRC</button>
      <button class="rkey" @click="$emit('send', 'mute')" title="Mute">🔇</button>
      <button class="rkey rkey--fn" @click="$emit('send', 'settings')" title="Settings">⚙</button>
    </div>

    <div class="r-divider"></div>

    <div class="r-dpad">
      <span></span>
      <button class="rkey r-arrow" @click="$emit('send', 'up')">▲</button>
      <span></span>
      <button class="rkey r-arrow" @click="$emit('send', 'left')">◀</button>
      <button class="rkey r-ok"   @click="$emit('send', 'ok')">OK</button>
      <button class="rkey r-arrow" @click="$emit('send', 'right')">▶</button>
      <span></span>
      <button class="rkey r-arrow" @click="$emit('send', 'down')">▼</button>
      <span></span>
    </div>

    <div class="r-row3">
      <button class="rkey rkey--fn" @click="$emit('send', 'back')" title="Back">◁</button>
      <button class="rkey rkey--home" @click="$emit('send', 'home')" title="Home">⌂</button>
      <button class="rkey rkey--fn" @click="$emit('send', 'info')" title="Info">ℹ</button>
    </div>

    <div class="r-divider"></div>

    <div class="r-row3">
      <button class="rkey" @click="$emit('send', 'vol_down')">V-</button>
      <button class="rkey" @click="$emit('send', 'ch_up')">CH+</button>
      <button class="rkey" @click="$emit('send', 'vol_up')">V+</button>
    </div>
    <div class="r-row3">
      <span></span>
      <button class="rkey" @click="$emit('send', 'ch_down')">CH-</button>
      <span></span>
    </div>

    <div class="r-divider"></div>

    <div class="r-row3">
      <button class="rkey" @click="$emit('send', 'previous')" title="Previous">⏮</button>
      <button class="rkey" @click="$emit('send', 'play_pause')" title="Play/Pause">⏯</button>
      <button class="rkey" @click="$emit('send', 'next')" title="Next">⏭</button>
    </div>

    <slot />
  </div>
</template>

<script setup>
defineEmits(['send']);
</script>

<style scoped>
@import './remote-shared.css';
</style>
