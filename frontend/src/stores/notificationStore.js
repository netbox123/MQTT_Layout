import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useNotificationStore = defineStore('notifications', () => {
  const notifications      = ref([]);
  const activeNotification = ref(null);  // drives the overlay
  const announcementBase   = ref('');    // local URL base for MA sound announcements

  function add(n) {
    notifications.value    = [n, ...notifications.value].slice(0, 100);
    activeNotification.value = n;
  }

  function dismiss(id) {
    notifications.value = notifications.value.filter(n => n.id !== id);
  }

  function clear() {
    notifications.value = [];
  }

  function seed(items) {
    notifications.value = items;
  }

  function clearActive() {
    activeNotification.value = null;
  }

  return { notifications, activeNotification, announcementBase, add, dismiss, clear, clearActive, seed };
});
