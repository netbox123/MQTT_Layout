import { createApp, ref } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import { createAppRouter, createPageRoute } from './router/index.js';
import { useMqtt } from './composables/useMqtt.js';
import { useNotificationStore } from './stores/notificationStore.js';

async function bootstrap() {
  const { router, pageConfigs } = await createAppRouter();

  const app = createApp(App);
  const pinia = createPinia();

  app.use(pinia);
  app.use(router);

  const pageConfigsRef = ref(pageConfigs);
  const editingRef = ref(false);

  // Make pageConfigs available app-wide via provide/inject
  app.provide('pageConfigs', pageConfigsRef);
  app.provide('editing', editingRef);

  // Allow any component to add a new page without a full reload
  app.provide('addPage', (config) => {
    router.addRoute(createPageRoute(config));
    pageConfigsRef.value = [...pageConfigsRef.value, config];
    router.push(config.path);
  });

  // Allow any component to remove a page without a full reload
  app.provide('remove_page', (config) => {
    router.removeRoute(config.name);
    const remaining = pageConfigsRef.value.filter(p => p.path !== config.path);
    pageConfigsRef.value = remaining;
    if (remaining.length > 0) router.push(remaining[0].path);
  });

  app.mount('#app');

  // Load notification history from server
  try {
    const res  = await fetch('/api/notifications');
    const log  = await res.json();
    const notifStore = useNotificationStore();
    notifStore.seed(log);
  } catch { /* non-critical */ }

  // Start WebSocket after Pinia is active
  const { connect } = useMqtt();
  connect();
}

bootstrap().catch((err) => {
  console.error('Failed to start app:', err);
  document.body.innerHTML = `<div style="padding:2rem;color:red;font-family:monospace">
    <h2>Failed to load dashboard</h2><pre>${err.message}</pre>
  </div>`;
});
