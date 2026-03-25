<template>
  <div class="card weather-card">
    <div v-if="loading && !current" class="weather-state">Loading…</div>
    <div v-else-if="error" class="weather-state weather-error">{{ error }}</div>
    <template v-else-if="current">
      <!-- Header: location + current conditions -->
      <div class="weather-top">
        <div class="weather-location">{{ card.location_name || 'Weather' }}</div>
        <div class="weather-now">
          <svg class="icon-now" viewBox="0 0 24 24">
            <path :d="weatherIcon(current.symbol)" fill="currentColor" />
          </svg>
          <div class="now-right">
            <span class="now-temp">{{ Math.round(current.temp) }}°C</span>
            <span class="now-label">{{ conditionLabel(current.symbol) }}</span>
          </div>
        </div>
        <div class="weather-meta">
          <span class="meta-item">
            <svg viewBox="0 0 24 24" class="icon-sm"><path :d="iconWind" fill="currentColor" /></svg>
            {{ Math.round(current.wind) }}&nbsp;m/s
          </span>
          <span class="meta-item">
            <svg viewBox="0 0 24 24" class="icon-sm"><path :d="iconHumidity" fill="currentColor" /></svg>
            {{ Math.round(current.humidity) }}%
          </span>
          <span v-if="current.pressure" class="meta-item">
            <svg viewBox="0 0 24 24" class="icon-sm"><path :d="iconGauge" fill="currentColor" /></svg>
            {{ Math.round(current.pressure) }}&nbsp;hPa
          </span>
        </div>
      </div>

      <!-- Forecast row -->
      <div class="weather-forecast">
        <div v-for="day in forecast" :key="day.date" class="forecast-day">
          <span class="fc-dow">{{ day.dow }}</span>
          <svg class="icon-fc" viewBox="0 0 24 24">
            <path :d="weatherIcon(day.symbol)" fill="currentColor" />
          </svg>
          <span class="fc-hi">{{ Math.round(day.hi) }}°</span>
          <span class="fc-lo">{{ Math.round(day.lo) }}°</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
export const icon = '🌤';
</script>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  mdiWeatherSunny, mdiWeatherNight, mdiWeatherPartlyCloudy, mdiWeatherNightPartlyCloudy,
  mdiWeatherCloudy, mdiWeatherFog, mdiWeatherRainy, mdiWeatherPouring,
  mdiWeatherHail, mdiWeatherSnowy, mdiWeatherSnowyHeavy,
  mdiWeatherLightningRainy, mdiWeatherLightning,
  mdiWeatherWindy, mdiWater, mdiSpeedometer,
} from '@mdi/js';

const iconWind = mdiWeatherWindy;
const iconHumidity = mdiWater;
const iconGauge = mdiSpeedometer;

const props = defineProps({
  card: { type: Object, required: true },
});

const loading = ref(false);
const error = ref('');
const rawData = ref(null);

// ── Symbol → MDI icon ────────────────────────────────────────────────────────
function weatherIcon(symbol) {
  if (!symbol) return mdiWeatherCloudy;
  const s = symbol.replace(/_day$|_night$/, '');
  const night = symbol.endsWith('_night');
  if (s === 'clearsky' || s === 'fair') return night ? mdiWeatherNight : mdiWeatherSunny;
  if (s === 'partlycloudy') return night ? mdiWeatherNightPartlyCloudy : mdiWeatherPartlyCloudy;
  if (s === 'cloudy') return mdiWeatherCloudy;
  if (s === 'fog') return mdiWeatherFog;
  if (s.includes('thunder')) return s.includes('rain') || s.includes('sleet') ? mdiWeatherLightningRainy : mdiWeatherLightning;
  if (s.includes('heavyrain') || s.includes('heavyrainshowers')) return mdiWeatherPouring;
  if (s.includes('rain') || s.includes('rainshowers')) return mdiWeatherRainy;
  if (s.includes('sleet')) return mdiWeatherHail;
  if (s.includes('heavysnow')) return mdiWeatherSnowyHeavy;
  if (s.includes('snow')) return mdiWeatherSnowy;
  return mdiWeatherCloudy;
}

// ── Symbol → human label ─────────────────────────────────────────────────────
function conditionLabel(symbol) {
  if (!symbol) return '';
  const s = symbol.replace(/_day$|_night$/, '');
  const labels = {
    clearsky: 'Clear sky',
    fair: 'Fair',
    partlycloudy: 'Partly cloudy',
    cloudy: 'Cloudy',
    fog: 'Fog',
    lightrain: 'Light rain',
    rain: 'Rain',
    heavyrain: 'Heavy rain',
    lightrainshowers: 'Light showers',
    rainshowers: 'Showers',
    heavyrainshowers: 'Heavy showers',
    lightsleet: 'Light sleet',
    sleet: 'Sleet',
    heavysleet: 'Heavy sleet',
    lightsnow: 'Light snow',
    snow: 'Snow',
    heavysnow: 'Heavy snow',
    lightsnowshowers: 'Light snow showers',
    snowshowers: 'Snow showers',
    heavysnowshowers: 'Heavy snow showers',
    lightrainandthunder: 'Light rain & thunder',
    rainandthunder: 'Rain & thunder',
    heavyrainandthunder: 'Heavy rain & thunder',
    lightsleetandthunder: 'Sleet & thunder',
    sleetandthunder: 'Sleet & thunder',
    heavysleetandthunder: 'Heavy sleet & thunder',
    lightsnowandthunder: 'Snow & thunder',
    snowandthunder: 'Snow & thunder',
    heavysnowandthunder: 'Heavy snow & thunder',
  };
  for (const [key, label] of Object.entries(labels)) {
    if (s.startsWith(key)) return label;
  }
  return symbol;
}

// ── Parsed data ───────────────────────────────────────────────────────────────
const current = computed(() => {
  const ts = rawData.value?.properties?.timeseries;
  if (!ts?.length) return null;
  const entry = ts[0];
  const d = entry.data?.instant?.details ?? {};
  const symbol = entry.data?.next_1_hours?.summary?.symbol_code
    ?? entry.data?.next_6_hours?.summary?.symbol_code ?? '';
  return {
    temp: d.air_temperature ?? 0,
    wind: d.wind_speed ?? 0,
    humidity: d.relative_humidity ?? 0,
    pressure: d.air_pressure_at_sea_level ?? null,
    symbol,
  };
});

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const forecast = computed(() => {
  const ts = rawData.value?.properties?.timeseries;
  if (!ts?.length) return [];

  // group by local date string
  const byDay = new Map();
  for (const entry of ts) {
    const date = entry.time.slice(0, 10); // YYYY-MM-DD
    if (!byDay.has(date)) byDay.set(date, []);
    byDay.get(date).push(entry);
  }

  const today = ts[0].time.slice(0, 10);
  const days = [];

  for (const [date, entries] of byDay) {
    if (date === today) continue; // skip today
    if (days.length >= 6) break;

    // prefer noon entry with next_12_hours; else any with next_6_hours
    const noon = entries.find(e => e.time.includes('T12:00'));
    const withNext12 = entries.find(e => e.data?.next_12_hours);
    const withNext6 = entries.find(e => e.data?.next_6_hours?.details?.air_temperature_max != null);
    const pick = noon ?? withNext12 ?? withNext6 ?? entries[0];

    const next12 = pick.data?.next_12_hours;
    const next6 = pick.data?.next_6_hours;

    let hi = next12?.details?.air_temperature_max ?? next6?.details?.air_temperature_max;
    let lo = next12?.details?.air_temperature_min ?? next6?.details?.air_temperature_min;

    // fallback: derive from all entries that day
    if (hi == null) {
      const temps = entries.map(e => e.data?.instant?.details?.air_temperature).filter(t => t != null);
      hi = temps.length ? Math.max(...temps) : 0;
      lo = temps.length ? Math.min(...temps) : 0;
    }

    const symbol = next12?.summary?.symbol_code ?? next6?.summary?.symbol_code
      ?? pick.data?.next_1_hours?.summary?.symbol_code ?? '';

    const d = new Date(date + 'T12:00:00');
    days.push({ date, dow: DOW[d.getDay()], symbol, hi: hi ?? 0, lo: lo ?? 0 });
  }

  return days;
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchWeather() {
  const lat = props.card.lat;
  const lon = props.card.lon;
  if (!lat || !lon) { error.value = 'Set lat/lon in card settings'; return; }
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
    if (!res.ok) { error.value = `Error ${res.status}`; return; }
    rawData.value = await res.json();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

let timer = null;
onMounted(() => {
  fetchWeather();
  timer = setInterval(fetchWeather, 15 * 60 * 1000);
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow: hidden;
}

.weather-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  color: #9aa3bc;
}

.weather-error { color: var(--accent-red, #e05); }

/* Top section */
.weather-top {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.weather-location {
  font-size: 0.7rem;
  font-weight: 600;
  color: #9aa3bc;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.weather-now {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon-now {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  color: var(--accent-yellow, #f5a623);
}

.now-right {
  display: flex;
  flex-direction: column;
}

.now-temp {
  font-size: 2rem;
  font-weight: 400;
  color: var(--text-primary);
  line-height: 1;
}

.now-label {
  font-size: 0.75rem;
  color: #9aa3bc;
  margin-top: 0.15rem;
}

.weather-meta {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.75rem;
  color: #9aa3bc;
}

.icon-sm {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* Forecast row */
.weather-forecast {
  display: flex;
  border-top: 1px solid var(--border);
  padding-top: 0.4rem;
  gap: 0;
  margin-top: 1rem;
}

.forecast-day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.2rem 0.1rem;
  border-right: 1px solid var(--border);
}

.forecast-day:last-child { border-right: none; }

.fc-dow {
  font-size: 0.8rem;
  font-weight: 400;
  color: #9aa3bc;
  text-transform: uppercase;
}

.icon-fc {
  width: 26px;
  height: 26px;
  color: var(--accent-yellow, #f5a623);
}

.fc-hi {
  font-size: 0.92rem;
  font-weight: 400;
  color: var(--text-primary);
}

.fc-lo {
  font-size: 0.8rem;
  color: #9aa3bc;
}
</style>
