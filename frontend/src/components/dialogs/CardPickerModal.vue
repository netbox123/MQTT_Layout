<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">Add Card</h2>
        <div class="card-list">
          <button
            v-for="type in cardTypes"
            :key="type.id"
            class="card-type-btn"
            @click="$emit('pick', type.id)"
          >
            <span class="card-type-icon">{{ type.icon }}</span>
            <span class="card-type-name">{{ type.label }}</span>
          </button>
        </div>
        <div class="modal-actions">
          <button class="modal-cancel" @click="$emit('cancel')">Cancel</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineEmits(['pick', 'cancel']);

const cardModules = import.meta.glob('../cards/*.vue', { eager: true });

const cardTypes = Object.entries(cardModules).map(([path, mod]) => {
  const name = path.split('/').pop().replace(/Card\.vue$/, '');
  const id = name.toLowerCase();
  return { id, label: name, icon: mod.icon ?? '🃏' };
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.75rem;
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.card-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.card-type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s;
}

.card-type-btn:hover {
  background: var(--bg-card-hover);
  border-color: var(--accent-blue);
}

.card-type-icon {
  font-size: 1.5rem;
}

.card-type-name {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
}

.modal-cancel {
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  background: var(--bg-card);
  color: var(--text-secondary);
}

.modal-cancel:hover { background: var(--bg-card-hover); }
</style>
