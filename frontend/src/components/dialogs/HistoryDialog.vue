<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">{{ title }}</h2>
          <button class="modal-close" type="button" @click="$emit('close')">✕</button>
        </div>

        <div class="range-row">
          <button
            v-for="opt in ranges"
            :key="opt.hours"
            class="range-btn"
            :class="{ 'range-btn--active': hours === opt.hours }"
            type="button"
            @click="hours = opt.hours"
          >{{ opt.label }}</button>
        </div>

        <div class="chart-wrap">
          <canvas ref="canvasEl"></canvas>
          <div v-if="loading" class="chart-status">Loading…</div>
          <div v-else-if="!points.length" class="chart-status">No history yet</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

const props = defineProps({
  topic: { type: String, required: true },
  title: { type: String, default: '' },
  unit: { type: String, default: '' },
});
defineEmits(['close']);

const ranges = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
  { label: '30d', hours: 24 * 30 },
];

const hours = ref(24);
const points = ref([]);
const loading = ref(false);
const canvasEl = ref(null);
let chart = null;

async function load() {
  loading.value = true;
  try {
    const res = await fetch(`/api/history?topic=${encodeURIComponent(props.topic)}&hours=${hours.value}`);
    const data = await res.json();
    points.value = data.points ?? [];
  } catch {
    points.value = [];
  } finally {
    loading.value = false;
    renderChart();
  }
}

function renderChart() {
  if (!canvasEl.value) return;
  const data = points.value.map(p => ({ x: p.ts, y: Number(p.value) })).filter(p => !Number.isNaN(p.y));

  if (chart) {
    chart.data.datasets[0].data = data;
    chart.update();
    return;
  }

  chart = new Chart(canvasEl.value, {
    type: 'line',
    data: {
      datasets: [{
        data,
        borderColor: '#4f8ef7',
        backgroundColor: 'rgba(79, 142, 247, 0.12)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#4f8ef7',
        tension: 0.2,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'time',
          time: {
            displayFormats: {
              millisecond: 'HH:mm:ss.SSS',
              second: 'HH:mm:ss',
              minute: 'HH:mm',
              hour: 'HH:mm',
              day: 'MMM d',
              week: 'MMM d',
              month: 'MMM yyyy',
              quarter: 'qqq - yyyy',
              year: 'yyyy',
            },
          },
          ticks: {
            color: '#8892b0',
            callback: function (value, index, allTicks) {
              const d = new Date(value);
              if (hours.value > 24) {
                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              }
              const timeLabel = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
              const prev = index > 0 ? new Date(allTicks[index - 1].value) : null;
              const isNewDay = !prev || prev.getDate() !== d.getDate() || prev.getMonth() !== d.getMonth();
              if (!isNewDay) return timeLabel;
              const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              return [timeLabel, dateLabel];
            },
          },
          grid: { color: '#2d3452' },
        },
        y: {
          ticks: { color: '#8892b0', callback: v => props.unit ? `${v}${props.unit}` : v },
          grid: { color: '#2d3452' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1f2e',
          borderColor: '#2d3452',
          borderWidth: 1,
          titleColor: '#e8eaf0',
          bodyColor: '#e8eaf0',
          padding: 10,
          displayColors: false,
          callbacks: {
            title: items => items[0] ? new Date(items[0].parsed.x).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'medium',
              hour12: false,
            }) : '',
            label: item => `${item.parsed.y}${props.unit ?? ''}`,
          },
        },
      },
    },
  });
}

watch(hours, load);

onMounted(load);

onBeforeUnmount(() => {
  chart?.destroy();
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.5rem;
  width: 100%;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  line-height: 1;
  padding: 0.25rem;
}

.modal-close:hover { color: var(--text-primary); }

.range-row {
  display: flex;
  gap: 0.5rem;
}

.range-btn {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.range-btn:hover { background: #313858; }
.range-btn--active { color: var(--text-primary); border-color: var(--accent-blue); }

.chart-wrap {
  position: relative;
  height: 320px;
}

.chart-status {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  pointer-events: none;
}
</style>
