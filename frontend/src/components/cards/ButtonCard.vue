<template>
  <div class="card button-card">
    <button class="action-btn" @click="send" :class="{ 'action-btn--sent': sent }">
      {{ card.title }}
    </button>
  </div>
</template>

<script>
export const icon = '🔘';
</script>

<script setup>
import { ref } from 'vue';
import { useMqtt } from '../../composables/useMqtt.js';

const props = defineProps({
  card: { type: Object, required: true },
});

const { publish } = useMqtt();
const sent = ref(false);
let sentTimer = null;

function send() {
  publish(props.card.command_topic, props.card.command_value ?? '');
  sent.value = true;
  clearTimeout(sentTimer);
  sentTimer = setTimeout(() => { sent.value = false; }, 600);
}
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn {
  width: 100%;
  height: 100%;
  border: 1px solid var(--accent-blue);
  border-radius: 6px;
  background: transparent;
  color: var(--accent-blue);
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  transition: background 0.15s, color 0.15s, transform 0.1s;
}

.action-btn:hover {
  background: var(--accent-blue);
  color: #fff;
}

.action-btn:active,
.action-btn--sent {
  transform: scale(0.96);
  background: var(--accent-blue);
  color: #fff;
}
</style>
