import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useTowStore = defineStore('tow', () => {
  const tows        = ref([]);
  const selectedId  = ref(null);
  const loaded      = ref(false);
  const loading     = ref(false);

  async function load() {
    if (loaded.value || loading.value) return;
    await refresh();
  }

  // Unlike load(), always re-fetches — used after a GIGA sync pull adds new tow records.
  async function refresh() {
    loading.value = true;
    try {
      const res = await fetch('/api/tows');
      tows.value = res.ok ? await res.json() : [];
      if (tows.value.length && !tows.value.some(t => t.id === selectedId.value)) {
        selectedId.value = tows.value[0].id;
      }
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  const years = computed(() => {
    const set = new Set(tows.value.map(t => (t.date ?? '').slice(0, 4)).filter(Boolean));
    return [...set].sort();
  });

  const selectedTow = computed(() => tows.value.find(t => t.id === selectedId.value) ?? null);

  function select(id) { selectedId.value = id; }

  return { tows, selectedId, loaded, loading, load, refresh, years, selectedTow, select };
});
