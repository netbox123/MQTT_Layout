<template>
  <div class="webpage-card">
    <iframe
      v-if="card.url"
      :src="card.url"
      class="webpage-frame"
      frameborder="0"
      allowfullscreen
    />
    <div v-else class="webpage-placeholder">No URL configured</div>
  </div>
</template>

<script>
export const icon = '🌐';
</script>

<script setup>
defineProps({
  card: { type: Object, required: true },
});
</script>

<style scoped>
.webpage-card {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.webpage-frame {
  width: 100%;
  height: 100%;
  display: block;
  border: none;
}

.webpage-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: var(--text-muted);
}
</style>
