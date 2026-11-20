<template>
  <div class="card towdetail-card">
    <template v-if="tow">
      <div class="towdetail-title">{{ titleLabel }}</div>
      <div class="towdetail-chart-wrap">
        <div class="towdetail-chart-panel">
          <svg ref="svgRef" class="towdetail-chart" :viewBox="`0 0 ${plotDims.totalW} ${plotDims.totalH}`" preserveAspectRatio="xMidYMid meet">
            <text class="chart-unit" x="6" y="14">m</text>
            <template v-for="(gl, i) in gridLines" :key="i">
              <line class="chart-grid" :x1="padL" :x2="plotDims.totalW - padR" :y1="gl.y" :y2="gl.y" />
              <text class="chart-axis-label" :x="padL - 6" :y="gl.y + 3" text-anchor="end">{{ gl.label }}</text>
            </template>
            <template v-for="(xl, i) in xGridLines" :key="'x' + i">
              <line class="chart-grid" :x1="xl.x" :x2="xl.x" :y1="padT" :y2="plotDims.totalH - padB" />
              <text class="chart-axis-label" :x="xl.x" :y="plotDims.totalH - 4" text-anchor="middle">{{ xl.label }}</text>
            </template>
            <polyline class="chart-line" :points="polylinePoints" />
            <circle v-for="(m, i) in markerSamples" :key="'mk' + i" class="chart-marker" :cx="xFor(m.dist)" :cy="yFor(m.alt)" r="3.2" />
            <template v-if="hoveredSample">
              <line class="chart-crosshair" :x1="xFor(hoveredSample.dist)" :x2="xFor(hoveredSample.dist)" :y1="yFor(hoveredSample.alt)" :y2="plotDims.totalH - padB" />
              <line class="chart-crosshair" :x1="padL" :x2="xFor(hoveredSample.dist)" :y1="yFor(hoveredSample.alt)" :y2="yFor(hoveredSample.alt)" />
              <circle class="chart-hover-dot" :cx="xFor(hoveredSample.dist)" :cy="yFor(hoveredSample.alt)" r="3.5" />
            </template>
            <rect
              class="chart-capture"
              :x="padL" :y="padT" :width="plotDims.innerW" :height="plotDims.innerH"
              @mousemove="onChartHover" @mouseleave="hoveredIndex = null"
            />
          </svg>
          <div v-if="hoveredSample" class="chart-tooltip" :style="tooltipStyle">
            <div class="tooltip-row"><span class="tooltip-label">State</span><span>{{ hoveredSample.state }}</span></div>
            <div class="tooltip-row"><span class="tooltip-label">Height</span><span>{{ Math.round(hoveredSample.alt) }} m</span></div>
            <div class="tooltip-row"><span class="tooltip-label">Distance</span><span>{{ Math.round(hoveredSample.dist) }} m</span></div>
            <div class="tooltip-row"><span class="tooltip-label">Time</span><span>{{ formatFlightTime(hoveredSample.t) }}</span></div>
            <div v-if="hoveredSample.tension !== undefined" class="tooltip-row"><span class="tooltip-label">Force</span><span>{{ Math.round(hoveredSample.tension) }} kg</span></div>
          </div>
        </div>
      </div>
      <a v-if="mapUrl" class="towdetail-map-link" :href="mapUrl" target="_blank" rel="noopener">Show Map</a>
      <span v-else class="towdetail-map-link towdetail-map-link--disabled" title="No GPS samples for this tow">Show Map</span>
    </template>
    <div v-else class="towdetail-empty">No tow selected</div>
  </div>
</template>

<script>
export const icon = '📈';
</script>

<script setup>
import { computed, ref } from 'vue';
import { useTowStore } from '../../stores/towStore.js';

defineProps({ card: { type: Object, required: true } });

const store = useTowStore();
const tow = computed(() => store.selectedTow);

const titleLabel = computed(() => {
  if (!tow.value) return '';
  const d = new Date(tow.value.date);
  const date = isNaN(d) ? tow.value.date : `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return tow.value.pilot ? `${date} ${tow.value.pilot}` : date;
});

const padL = 34, padR = 8, padT = 20, padB = 20;

// Ground distance from the winch = sqrt(line_length^2 - height^2) (Pythagoras: the paid-out
// line is the hypotenuse, height is the vertical leg). Counted from 0 at the winch itself, so
// it's largest at launch (far from the winch) and shrinks as the winch reels in and the pilot
// is pulled up and inward toward it.
const profileSamples = computed(() => {
  const raw = (tow.value?.samples ?? []).filter(s => typeof s.baro_alt_m === 'number' && typeof s.line_length_m === 'number');
  if (!raw.length) return [];
  const groundDist = s => Math.sqrt(Math.max(0, s.line_length_m ** 2 - s.baro_alt_m ** 2));
  return raw.map(s => ({ alt: s.baro_alt_m, dist: groundDist(s), state: s.state, t: s.t ?? 0, tension: s.tension_kg }));
});

// Marker dots at the key state transitions: the very start, losing ground contact (first
// UNDER_TREE_HEIGHT sample), normal tow starting (first NORMAL_TOW sample), and release (the
// last sample).
const markerSamples = computed(() => {
  const samples = profileSamples.value;
  if (!samples.length) return [];
  const markers = [samples[0]];
  const underTreeHeight = samples.find(s => s.state === 'UNDER_TREE_HEIGHT');
  if (underTreeHeight) markers.push(underTreeHeight);
  const normalTow = samples.find(s => s.state === 'NORMAL_TOW');
  if (normalTow) markers.push(normalTow);
  const last = samples[samples.length - 1];
  if (last !== markers[markers.length - 1]) markers.push(last);
  return markers;
});

// Rounded up to the next whole 100m so the outermost gridline always lands exactly on the
// plot's edge, instead of leaving a partial, gridline-less gap above/right of the last one.
const altRange = computed(() => {
  const alts = profileSamples.value.map(s => s.alt);
  const dataMax = alts.length ? Math.max(0, ...alts) : 100;
  return { min: 0, max: Math.max(100, Math.ceil((dataMax * 1.1) / 100) * 100) };
});

const distRange = computed(() => {
  const dists = profileSamples.value.map(s => s.dist);
  const dataMax = dists.length ? Math.max(0, ...dists) : 100;
  return { min: 0, max: Math.max(100, Math.ceil((dataMax * 1.05) / 100) * 100) };
});

// Same meters-per-pixel on both axes, so the plotted flight path is drawn at its true physical
// angle (a real climb, a real glide-down) instead of being stretched to fill whatever shape the
// card box happens to be. Height stays a fixed reference; width is derived from the actual
// distance/height data ratio, then the SVG letterboxes ("meet") rather than distorting to fill.
const plotDims = computed(() => {
  const distSpan = distRange.value.max - distRange.value.min || 1;
  const altSpan = altRange.value.max - altRange.value.min || 1;
  const innerH = 220 - padT - padB;
  const aspect = Math.max(0.5, Math.min(8, distSpan / altSpan));
  const innerW = innerH * aspect;
  return { innerW, innerH, totalW: innerW + padL + padR, totalH: 220 };
});

function xFor(dist) {
  const { min, max } = distRange.value;
  const ratio = (dist - min) / (max - min);
  // Largest distance (launch, far from the winch) on the right, smallest (release, near the winch) on the left.
  return padL + ratio * plotDims.value.innerW;
}
function yFor(alt) {
  const { min, max } = altRange.value;
  const ratio = (alt - min) / (max - min);
  return (plotDims.value.totalH - padB) - ratio * plotDims.value.innerH;
}

const polylinePoints = computed(() =>
  profileSamples.value.map(s => `${xFor(s.dist).toFixed(1)},${yFor(s.alt).toFixed(1)}`).join(' ')
);

const gridLines = computed(() => {
  const { max } = altRange.value;
  const lines = [];
  for (let alt = 0; alt <= max; alt += 100) {
    lines.push({ y: yFor(alt), label: alt });
  }
  return lines;
});

const xGridLines = computed(() => {
  const { max } = distRange.value;
  const lines = [];
  for (let dist = 0; dist <= max; dist += 100) {
    lines.push({ x: xFor(dist), label: dist });
  }
  return lines;
});

// ── Hover tooltip (HA-style: nearest sample by x, crosshair + dot + a small box) ──────────────
const svgRef = ref(null);
const hoveredIndex = ref(null);
const hoveredSample = computed(() => hoveredIndex.value === null ? null : profileSamples.value[hoveredIndex.value] ?? null);

function onChartHover(evt) {
  const samples = profileSamples.value;
  if (!samples.length || !svgRef.value) return;
  const pt = svgRef.value.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const ctm = svgRef.value.getScreenCTM();
  if (!ctm) return;
  const svgP = pt.matrixTransform(ctm.inverse());
  let bestIdx = 0, bestDist = Infinity;
  samples.forEach((s, i) => {
    const d = Math.abs(xFor(s.dist) - svgP.x);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  });
  hoveredIndex.value = bestIdx;
}

const tooltipStyle = computed(() => {
  if (!hoveredSample.value || !svgRef.value) return { display: 'none' };
  const pt = svgRef.value.createSVGPoint();
  pt.x = xFor(hoveredSample.value.dist);
  pt.y = yFor(hoveredSample.value.alt);
  const ctm = svgRef.value.getScreenCTM();
  if (!ctm) return { display: 'none' };
  const screenPt = pt.matrixTransform(ctm);
  const panelRect = svgRef.value.parentElement.getBoundingClientRect();
  return {
    left: `${screenPt.x - panelRect.left}px`,
    top: `${screenPt.y - panelRect.top}px`,
  };
});

function formatFlightTime(t) {
  const total = Math.round(t ?? 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const mapUrl = computed(() => {
  const pts = (tow.value?.samples ?? []).filter(s => typeof s.lat === 'number' && typeof s.lon === 'number');
  if (!pts.length) return null;
  const step = Math.max(1, Math.ceil(pts.length / 25));
  const coords = pts.filter((_, i) => i % step === 0).map(s => `${s.lat},${s.lon}`);
  return `https://www.google.com/maps/dir/${coords.join('/')}`;
});
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow: hidden;
}

.towdetail-title {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--accent-yellow);
}

.towdetail-chart-wrap {
  flex: 1;
  min-height: 0;
}

.towdetail-chart-panel {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem;
}

.towdetail-chart {
  width: 100%;
  height: 100%;
  display: block;
}

.chart-grid {
  stroke: var(--border);
  stroke-width: 1;
}

.chart-axis-label {
  font-size: 8px;
  fill: var(--text-secondary);
}

.chart-unit {
  font-size: 8px;
  fill: var(--text-muted);
}

.chart-line {
  fill: none;
  stroke: var(--accent-blue);
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.chart-marker {
  fill: var(--accent-yellow);
  stroke: var(--bg-base);
  stroke-width: 1;
}

.chart-crosshair {
  stroke: var(--text-secondary);
  stroke-width: 1;
  stroke-dasharray: 3 2;
  pointer-events: none;
}

.chart-hover-dot {
  fill: var(--text-primary);
  stroke: var(--accent-blue);
  stroke-width: 1.5;
  pointer-events: none;
}

.chart-capture {
  fill: transparent;
  cursor: crosshair;
}

.chart-tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 10px));
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  font-size: 0.72rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--text-primary);
}

.tooltip-label {
  color: var(--text-secondary);
}

.towdetail-map-link {
  align-self: flex-end;
  font-size: 0.8rem;
  color: var(--accent-blue);
}

.towdetail-map-link:hover {
  text-decoration: underline;
}

.towdetail-map-link--disabled {
  color: var(--text-muted);
  cursor: default;
  pointer-events: none;
}

.towdetail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  color: var(--text-muted);
}
</style>
