<template>
  <div class="remote">
    <div class="r-brand">PHILIPS</div>

    <div class="r-center">
      <button class="rkey rkey--power" title="Power / Standby" @click="$emit('send', 'power')">⏻</button>
    </div>

    <div class="r-row3">
      <button class="rkey" title="Previous"     @click="$emit('send', 'previous')">⏮</button>
      <button class="rkey" title="Play / Pause" @click="$emit('send', 'play_pause')">⏯</button>
      <button class="rkey" title="Next"         @click="$emit('send', 'next')">⏭</button>
    </div>

    <div class="r-row3">
      <button class="rkey" title="Rewind"       @click="$emit('send', 'rewind')">⏪</button>
      <button class="rkey" title="Stop"         @click="$emit('send', 'stop')">⏹</button>
      <button class="rkey" title="Fast Forward" @click="$emit('send', 'fast_forward')">⏩</button>
    </div>

    <div class="r-divider"></div>

    <div class="r-dpad-group">
      <div class="r-row3">
        <button class="rkey rkey--fn" title="Source / Inputs" @click="$emit('send', 'source')">SRC</button>
        <span></span>
        <button class="rkey" title="Info" @click="$emit('send', 'info')">ℹ</button>
      </div>
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
    </div>

    <div class="r-block r-block--overlap">
      <div class="r-row3">
        <button class="rkey rkey--fn" title="Back"    @click="$emit('send', 'back')">◁ BACK</button>
        <span></span>
        <button class="rkey rkey--fn" title="Options" @click="$emit('send', 'options')">LIST</button>
      </div>
      <div class="r-row3">
        <button class="rkey" title="Volume Down" @click="$emit('send', 'vol_down')">V-</button>
        <button class="rkey rkey--home" title="Home" @click="$emit('send', 'home')"><span class="home-icon">⌂</span></button>
        <button class="rkey" title="Volume Up"   @click="$emit('send', 'vol_up')">V+</button>
      </div>
    </div>

    <div class="r-divider"></div>
    <div class="r-divider"></div>

    <div class="r-colors">
      <button class="rkey rkey--red"    @click="$emit('send', 'red')"></button>
      <button class="rkey rkey--green"  @click="$emit('send', 'green')"></button>
      <button class="rkey rkey--yellow" @click="$emit('send', 'yellow')"></button>
      <button class="rkey rkey--blue"   @click="$emit('send', 'blue')"></button>
    </div>

    <slot />
  </div>
</template>

<script setup>
defineEmits(['send']);
</script>

<style scoped>
@import './remote-shared.css';

.r-dpad-group { display: flex; flex-direction: column; }
.r-dpad-group .r-dpad { margin-top: -21px; }
.r-block { display: flex; flex-direction: column; gap: 8px; }
.r-block--overlap { margin-top: -33px; }
.home-icon { display: inline-block; transform: translateY(-4px); }

.rkey--red    { width: 43px; height: 20px; border-radius: 10px; background: #7a1515; border-color: #9a2020; border-bottom-color: #4a0c0c; font-size: 0; }
.rkey--green  { width: 43px; height: 20px; border-radius: 10px; background: #156015; border-color: #207820; border-bottom-color: #0c3a0c; font-size: 0; }
.rkey--yellow { width: 43px; height: 20px; border-radius: 10px; background: #706010; border-color: #887818; border-bottom-color: #403808; font-size: 0; }
.rkey--blue   { width: 43px; height: 20px; border-radius: 10px; background: #151578; border-color: #201898; border-bottom-color: #0c0c48; font-size: 0; }

.rkey--red:hover    { background: #9a1e1e; }
.rkey--green:hover  { background: #1e781e; }
.rkey--yellow:hover { background: #887818; }
.rkey--blue:hover   { background: #201898; }
</style>
