<template>
  <div class="app-layout">
    <Sidebar v-if="!isMobile" :pages="pageConfigs" />
    <main class="main-content" :class="{ 'main-content--mobile': isMobile }">
      <router-view :key="route.path" />
    </main>
  </div>
  <NotificationOverlay />
</template>

<script setup>
import { computed, inject } from 'vue';
import { useRoute } from 'vue-router';
import Sidebar from './components/layout/Sidebar.vue';
import NotificationOverlay from './components/NotificationOverlay.vue';

const pageConfigs = inject('pageConfigs', []);
const route = useRoute();
const isMobile = computed(() => route.path.startsWith('/m/') || route.path === '/remote');
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100%;
  background: var(--bg-base);
}

.main-content {
  flex: 1;
  overflow: auto;
  padding: 0.75rem;
  min-width: 0;
}

.main-content--mobile {
  padding: 0;
}
</style>
