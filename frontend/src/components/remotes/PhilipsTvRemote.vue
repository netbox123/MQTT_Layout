<template>
  <div class="remote-shell">
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
  </div>
</template>

<script setup>
defineEmits(['send']);
</script>

<style scoped>
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
