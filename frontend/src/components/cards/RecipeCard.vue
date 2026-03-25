<template>
  <div class="card recipe-card">
    <!-- Header -->
    <div class="recipe-header">
      <svg viewBox="0 0 24 24" fill="currentColor" class="recipe-header-icon"><path :d="mdiChefHat" /></svg>
      <span class="recipe-header-title">Recipes</span>
      <button class="recipe-add-btn" title="Add recipe" @click="openNew">+</button>
    </div>

    <!-- Grid of recipe tiles -->
    <div class="recipe-grid">
      <div
        v-for="r in recipes"
        :key="r.id"
        class="recipe-tile"
        @click="openDetail(r)"
      >
        <div class="recipe-tile-img">
          <img v-if="r.image" :src="`/api/recipes/images/${r.image}`" :alt="r.title" />
          <svg v-else viewBox="0 0 24 24" fill="currentColor" class="recipe-tile-placeholder"><path :d="mdiImageOff" /></svg>
        </div>
        <span class="recipe-tile-title">{{ r.title }}</span>
      </div>
      <div v-if="!recipes.length" class="recipe-empty">No recipes yet — click + to add one</div>
    </div>
  </div>

  <!-- Detail modal -->
  <Teleport to="body">
    <div v-if="detail" class="recipe-backdrop" @click.self="detail = null">
      <div class="recipe-detail">
        <div class="recipe-detail-header">
          <span class="recipe-detail-title">{{ detail.title }}</span>
          <div class="recipe-detail-actions">
            <button class="recipe-icon-btn" title="Edit" @click="openEdit(detail)">
              <svg viewBox="0 0 24 24" fill="currentColor"><path :d="mdiPencil" /></svg>
            </button>
            <button class="recipe-icon-btn recipe-icon-btn--danger" title="Delete" @click="deleteRecipe(detail)">
              <svg viewBox="0 0 24 24" fill="currentColor"><path :d="mdiDelete" /></svg>
            </button>
            <button class="recipe-icon-btn" title="Close" @click="detail = null">
              <svg viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose" /></svg>
            </button>
          </div>
        </div>
        <div class="recipe-detail-body">
          <div v-if="detail.image" class="recipe-detail-img-wrap">
            <img :src="`/api/recipes/images/${detail.image}`" :alt="detail.title" class="recipe-detail-img" />
          </div>
          <div class="recipe-detail-content">
            <div v-if="detail.servings" class="recipe-detail-servings">
              <svg viewBox="0 0 24 24" fill="currentColor" class="recipe-meta-icon"><path :d="mdiAccountGroup" /></svg>
              {{ detail.servings }} servings
            </div>
            <div v-if="detail.ingredients?.length" class="recipe-section">
              <div class="recipe-section-title">Ingredients</div>
              <ul class="recipe-list">
                <li v-for="(ing, i) in detail.ingredients" :key="i">{{ ing }}</li>
              </ul>
            </div>
            <div v-if="detail.steps?.length" class="recipe-section">
              <div class="recipe-section-title">Steps</div>
              <ol class="recipe-list">
                <li v-for="(step, i) in detail.steps" :key="i">{{ step }}</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Edit / Add modal -->
  <RecipeEditModal
    v-if="showEdit"
    :recipe="editingRecipe"
    @save="onSaved"
    @cancel="showEdit = false"
  />
</template>

<script>
export const icon = '🍽';
</script>

<script setup>
import { ref, onMounted } from 'vue';
import { mdiChefHat, mdiImageOff, mdiPencil, mdiDelete, mdiClose, mdiAccountGroup } from '@mdi/js';
import RecipeEditModal from '../dialogs/RecipeEditModal.vue';

defineProps({ card: { type: Object, required: true } });

const recipes  = ref([]);
const detail   = ref(null);
const showEdit = ref(false);
const editingRecipe = ref(null);

async function load() {
  const res = await fetch('/api/recipes');
  recipes.value = await res.json();
}

onMounted(load);

function openDetail(r) { detail.value = r; }

function openNew() { editingRecipe.value = null; showEdit.value = true; }

function openEdit(r) { editingRecipe.value = r; detail.value = null; showEdit.value = true; }

async function deleteRecipe(r) {
  if (!confirm(`Delete "${r.title}"?`)) return;
  await fetch(`/api/recipes/${r.id}`, { method: 'DELETE' });
  detail.value = null;
  await load();
}

async function onSaved() {
  showEdit.value = false;
  await load();
}
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

/* Header */
.recipe-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: -3px;
}

.recipe-header-icon {
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.recipe-header-title {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
  flex: 1;
}

.recipe-add-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.2rem;
  transition: color 0.15s;
}
.recipe-add-btn:hover { color: var(--accent-blue); }

/* Tile grid */
.recipe-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 0.5rem;
  overflow-y: auto;
  min-height: 0;
}

.recipe-empty {
  grid-column: 1 / -1;
  font-size: 0.78rem;
  color: #9aa3bc;
  text-align: center;
  padding: 1rem 0;
}

.recipe-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  border-radius: 6px;
  padding: 0.35rem;
  transition: background 0.15s;
}
.recipe-tile:hover { background: var(--bg-card-hover); }

.recipe-tile-img {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 5px;
  overflow: hidden;
  background: var(--bg-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.recipe-tile-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.recipe-tile-placeholder {
  width: 32px;
  height: 32px;
  color: var(--text-muted);
}

.recipe-tile-title {
  font-size: 0.7rem;
  color: #9aa3bc;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* Detail modal */
.recipe-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.recipe-detail {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 560px;
  max-width: 95vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.recipe-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.recipe-detail-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.recipe-detail-actions {
  display: flex;
  gap: 0.25rem;
}

.recipe-icon-btn {
  background: none;
  border: none;
  color: #9aa3bc;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.recipe-icon-btn svg { width: 18px; height: 18px; }
.recipe-icon-btn:hover { color: var(--text-primary); }
.recipe-icon-btn--danger:hover { color: var(--accent-red); }

.recipe-detail-body {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex: 1;
}

.recipe-detail-img-wrap {
  width: 100%;
  max-height: 260px;
  overflow: hidden;
  flex-shrink: 0;
}

.recipe-detail-img {
  width: 100%;
  height: 260px;
  object-fit: cover;
}

.recipe-detail-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recipe-detail-servings {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: #9aa3bc;
}

.recipe-meta-icon {
  width: 14px;
  height: 14px;
}

.recipe-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #9aa3bc;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.4rem;
}

.recipe-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.recipe-list li {
  font-size: 0.9rem;
  color: var(--text-primary);
  line-height: 1.4;
}
</style>
