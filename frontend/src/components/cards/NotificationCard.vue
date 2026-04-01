<template>
  <div class="card notif-card">
    <div class="card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="header-icon"><path :d="mdiBell" /></svg>
      {{ card.title || 'Notifications' }}
    </div>
    <div v-if="!visible.length" class="notif-empty">No notifications</div>
    <div v-else class="notif-log">
      <div
        v-for="n in visible"
        :key="n.id"
        class="notif-line"
        :class="`notif-line--${n.level || 'info'}`"
      >
        <svg class="notif-line-icon" viewBox="0 0 24 24">
          <path :d="n.icon && ICON_MAP[n.icon] ? ICON_MAP[n.icon] : mdiBell" fill="currentColor" />
        </svg>
        <span class="notif-line-title">{{ n.title }}</span>
        <span class="notif-line-time">{{ fmtDateTime(n.timestamp) }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export const icon = '🔔';
</script>

<script setup>
import { computed, watchEffect } from 'vue';
import { useNotificationStore } from '../../stores/notificationStore.js';
import { ICON_MAP } from '../../utils/pageIcons.js';
import { mdiBell } from '@mdi/js';

const props = defineProps({
  card: { type: Object, required: true },
});

const store = useNotificationStore();

// Keep announcement base URL in sync with card config
watchEffect(() => {
  if (props.card.announcement_base_url) {
    store.announcementBase = props.card.announcement_base_url;
  }
});

const visible = computed(() => store.notifications.slice(0, props.card.max_items ?? 50));

function fmtDateTime(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${date} ${time}`;
}
</script>

<style scoped>
.notif-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.65rem 0.4rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-header {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding-bottom: 0.4rem;
  margin-bottom: 0.25rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.header-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.notif-log {
  flex: 1;
  overflow-y: auto;
  margin: -2px -0.65rem 0;
}

.notif-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: #9aa3bc;
}

.notif-log {
  flex: 1;
  overflow-y: auto;
}

.notif-line {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.22rem 0.65rem;
  white-space: nowrap;
  overflow: hidden;
}

.notif-line-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  color: #9aa3bc;
}


.notif-line-title {
  flex: 1;
  font-size: 0.8rem;
  color: #e8eaf0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-line-time {
  font-size: 0.7rem;
  color: #6b7499;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
</style>
