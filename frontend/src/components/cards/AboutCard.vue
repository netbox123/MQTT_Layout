<template>
  <div class="card about-card">
    <div class="about-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="about-header-icon"><path :d="mdiParagliding" /></svg>
      <span class="about-header-title">{{ card.title || 'About' }}</span>
      <button class="about-settings-btn" title="GIGA boot config" @click="showSettings = true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path :d="mdiCog" /></svg>
      </button>
    </div>
    <div class="about-logo-wrap">
      <img :src="logoSrc" :alt="card.title || 'logo'" class="about-logo" />
    </div>
    <a v-if="card.link_url" class="about-link" :href="card.link_url" target="_blank" rel="noopener">
      {{ card.link_text || card.link_url }}
    </a>
    <GigaBootConfigModal
      v-if="showSettings"
      @cancel="showSettings = false"
      @saved="showSettings = false"
    />
  </div>
</template>

<script>
export const icon = '🪂';
</script>

<script setup>
import { ref } from 'vue';
import { mdiParagliding, mdiCog } from '@mdi/js';
import logoDefault from '../../assets/winch_logo.png';
import GigaBootConfigModal from '../dialogs/GigaBootConfigModal.vue';

const props = defineProps({ card: { type: Object, required: true } });
const logoSrc = props.card.logo || logoDefault;
const showSettings = ref(false);
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

.about-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: -3px;
}

.about-header-icon {
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.about-settings-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 0.15rem;
  display: flex;
  align-items: center;
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}

.about-settings-btn svg {
  width: 14px;
  height: 14px;
}

.about-settings-btn:hover {
  color: var(--accent-blue);
  background: var(--bg-card-hover);
}

.about-header-title {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
}

.about-logo-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 0.25rem 0.5rem;
}

.about-logo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.about-link {
  font-size: 0.86rem;
  color: var(--accent-blue);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.about-link:hover {
  text-decoration: underline;
}
</style>
