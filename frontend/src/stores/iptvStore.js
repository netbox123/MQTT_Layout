import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useIptvStore = defineStore('iptv', () => {
  const channels    = ref([]);
  const countries   = ref([]);
  const categories  = ref([]);
  const favorites   = ref([]);
  const loaded      = ref(false);
  const loading     = ref(false);

  async function load() {
    if (loaded.value || loading.value) return;
    loading.value = true;
    try {
      const [ch, co, ca, fav] = await Promise.all([
        fetch('/api/iptv/channels').then(r => r.json()),
        fetch('/api/iptv/countries').then(r => r.json()),
        fetch('/api/iptv/categories').then(r => r.json()),
        fetch('/api/iptv/favorites').then(r => r.json()),
      ]);
      channels.value   = ch;
      countries.value  = co;
      categories.value = ca;
      favorites.value  = fav;
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  function isFavorite(id) {
    return favorites.value.includes(id);
  }

  async function toggleFavorite(id) {
    const next = isFavorite(id)
      ? favorites.value.filter(f => f !== id)
      : [...favorites.value, id];
    favorites.value = next;  // optimistic
    await fetch('/api/iptv/favorites', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
  }

  return { channels, countries, categories, favorites, loaded, loading, load, isFavorite, toggleFavorite };
});
