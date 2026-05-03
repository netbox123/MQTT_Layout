<template>
  <div class="mobile-page">
    <nav class="mobile-nav">
      <button
        v-for="p in mobilePages"
        :key="p.path"
        class="mobile-nav-link"
        :class="{ 'mobile-nav-link--active': p.path === activePath }"
        @click="setActive(p)"
      >{{ p.name }}</button>
      <button
        v-if="remoteMobileEnabled"
        class="mobile-nav-link"
        @click="router.push('/remote')"
      >Remote</button>
    </nav>
    <div v-if="error" class="mobile-error">{{ error }}</div>
    <div v-else class="mobile-cards">
      <div
        v-for="card in mobileCards"
        :key="card._idx"
        class="mobile-card-wrapper"
        :style="(card.type === 'url' || card.type === 'notification')
          ? { height: '220px' }
          : card.type === 'weather'
          ? { height: '225px' }
          : card.type === 'camera'
          ? { height: '224px' }
          : card.type === 'entities'
          ? { height: '204px' }
          : card.type === 'grid'
          ? { height: gridCardHeight(card) + 'px' }
          : { aspectRatio: `${cardMaxWidth(card)} / ${card.type === 'pizza' ? cardHeight(card) * 2 : cardHeight(card)}` }"
      >
        <component :is="cardComponent(card.type)" :card="card" :mobile="true" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SensorCard from '../components/cards/SensorCard.vue';
import GaugeCard from '../components/cards/GaugeCard.vue';
import SwitchCard from '../components/cards/SwitchCard.vue';
import TextCard from '../components/cards/TextCard.vue';
import ButtonCard from '../components/cards/ButtonCard.vue';
import CameraCard from '../components/cards/CameraCard.vue';
import WebpageCard from '../components/cards/WebpageCard.vue';
import GridCard from '../components/cards/GridCard.vue';
import IndicatorCard from '../components/cards/IndicatorCard.vue';
import WeatherCard from '../components/cards/WeatherCard.vue';
import EntitiesCard from '../components/cards/EntitiesCard.vue';
import MusicAssistantCard from '../components/cards/MusicAssistantCard.vue';
import RecipeCard from '../components/cards/RecipeCard.vue';
import PizzaCard from '../components/cards/PizzaCard.vue';
import UrlCard from '../components/cards/UrlCard.vue';
import NotificationCard from '../components/cards/NotificationCard.vue';

const route = useRoute();
const router = useRouter();
const allPages = ref([]);
const remoteMobileEnabled = ref(localStorage.getItem('remote_mobile_enabled') === 'true');
const activePath = ref('/' + route.params.slug);
const error = ref('');

const typeMap = {
  sensor: SensorCard, gauge: GaugeCard, switch: SwitchCard,
  text: TextCard, button: ButtonCard, camera: CameraCard,
  webpage: WebpageCard, grid: GridCard, indicator: IndicatorCard,
  weather: WeatherCard, entities: EntitiesCard,
  musicassistant: MusicAssistantCard, recipe: RecipeCard, pizza: PizzaCard, url: UrlCard, notification: NotificationCard,
};

function cardComponent(type) {
  return typeMap[type] ?? TextCard;
}

onMounted(async () => {
  try {
    const res = await fetch('/api/pages');
    if (!res.ok) throw new Error(res.statusText);
    const pages = await res.json();
    allPages.value = pages;
    if (!page.value) error.value = `Page not found`;
  } catch (e) {
    error.value = e.message;
  }
});

const mobilePages = computed(() =>
  allPages.value
    .filter(p => p.mobile !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
);

const page = computed(() =>
  allPages.value.find(p => p.path === activePath.value) ?? null
);

function setActive(p) {
  activePath.value = p.path;
}

function cardHeight(card) {
  const h = card.position?.h ?? 1;
  const cellH = page.value?.card_height ?? 120;
  const gap = page.value?.grid_spacing ?? 16;
  return h * cellH + (h - 1) * gap;
}

function gridCardHeight(card) {
  const items = card.items ?? [];
  const rows = Math.max(card.rows ?? card.position?.h ?? 2, ...items.map(i => (i.row ?? 0) + 1), 1);
  const ROW_H = 90;   // px per row
  const GAP   = 6;    // px gap between rows
  const PAD   = 12;   // px total vertical padding
  return rows * ROW_H + (rows - 1) * GAP + PAD;
}

function cardMaxWidth(card) {
  const w = card.position?.w ?? 1;
  const cellW = page.value?.card_width ?? 150;
  const gap = page.value?.grid_spacing ?? 16;
  return w * cellW + (w - 1) * gap;
}

const mobileCards = computed(() => {
  if (!page.value) return [];
  return page.value.cards
    .map((card, idx) => ({ ...card, _idx: idx }))
    .filter(card => card.mobile_show !== false)
    .sort((a, b) => {
      const oa = a.mobile_order ?? 0;
      const ob = b.mobile_order ?? 0;
      return oa !== ob ? oa - ob : a._idx - b._idx;
    });
});
</script>

<style scoped>
.mobile-page {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--bg-base);
}

.mobile-nav {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.mobile-nav::-webkit-scrollbar {
  display: none;
}

.mobile-nav-link {
  flex-shrink: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.65rem 1rem;
  white-space: nowrap;
  font-family: inherit;
  cursor: pointer;
}

.mobile-nav-link--active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-blue, #3b82f6);
}

.mobile-cards {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
}

.mobile-card-wrapper {
  width: 100%;
  flex-shrink: 0;
}

.mobile-card-wrapper > :first-child {
  width: 100%;
  height: 100%;
}

.mobile-error {
  padding: 1rem;
  color: var(--accent-red);
  font-size: 0.875rem;
}
</style>
