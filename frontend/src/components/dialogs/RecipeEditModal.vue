<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('cancel')">
      <div class="modal">
        <h2 class="modal-title">{{ recipe ? 'Edit Recipe' : 'New Recipe' }}</h2>

        <div class="fields">
          <label class="field-label">title</label>
          <input class="field-input" v-model="fields.title" placeholder="Recipe name" />

          <label class="field-label">servings</label>
          <input class="field-input" type="number" min="0" v-model.number="fields.servings" />

          <label class="field-label">image</label>
          <div class="image-field">
            <img v-if="previewUrl" :src="previewUrl" class="image-preview" alt="preview" />
            <label class="image-upload-btn">
              {{ previewUrl ? 'Change image' : 'Choose image…' }}
              <input type="file" accept="image/*" class="image-file-input" @change="onFileChange" />
            </label>
          </div>

          <label class="field-label">ingredients</label>
          <textarea class="field-textarea" v-model="fields.ingredientsText" placeholder="One ingredient per line" rows="5" />

          <label class="field-label">steps</label>
          <textarea class="field-textarea" v-model="fields.stepsText" placeholder="One step per line" rows="6" />

          <label class="field-label">tags</label>
          <input class="field-input" v-model="fields.tagsText" placeholder="italian, quick, vegetarian…" />
        </div>

        <p v-if="error" class="field-error">{{ error }}</p>

        <div class="modal-actions">
          <span></span>
          <div class="modal-actions-right">
            <button class="modal-cancel" @click="$emit('cancel')">Cancel</button>
            <button class="modal-confirm" @click="save" :disabled="saving">{{ saving ? 'Saving…' : 'OK' }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, ref, computed } from 'vue';

const props = defineProps({
  recipe: { type: Object, default: null },
});

const emit = defineEmits(['save', 'cancel']);

const fields = reactive({
  title:           props.recipe?.title ?? '',
  servings:        props.recipe?.servings ?? 0,
  ingredientsText: (props.recipe?.ingredients ?? []).join('\n'),
  stepsText:       (props.recipe?.steps ?? []).join('\n'),
  tagsText:        (props.recipe?.tags ?? []).join(', '),
});

const imageFile = ref(null);
const saving    = ref(false);
const error     = ref('');

const previewUrl = computed(() => {
  if (imageFile.value) return URL.createObjectURL(imageFile.value);
  if (props.recipe?.image) return `/api/recipes/images/${props.recipe.image}`;
  return '';
});

function onFileChange(e) {
  imageFile.value = e.target.files[0] ?? null;
}

async function save() {
  error.value = '';
  if (!fields.title.trim()) { error.value = 'Title is required'; return; }
  saving.value = true;
  try {
    const body = {
      title:       fields.title.trim(),
      servings:    fields.servings,
      ingredients: fields.ingredientsText.split('\n').map(s => s.trim()).filter(Boolean),
      steps:       fields.stepsText.split('\n').map(s => s.trim()).filter(Boolean),
      tags:        fields.tagsText.split(',').map(s => s.trim()).filter(Boolean),
    };

    let recipe;
    if (props.recipe) {
      const res = await fetch(`/api/recipes/${props.recipe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      recipe = await res.json();
    } else {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { error.value = (await res.json()).error; return; }
      recipe = await res.json();
    }

    // Upload image if selected
    if (imageFile.value) {
      const fd = new FormData();
      fd.append('image', imageFile.value);
      await fetch(`/api/recipes/${recipe.id}/image`, { method: 'POST', body: fd });
    }

    emit('save');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.75rem;
  width: 460px;
  max-width: 95vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.fields {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.6rem 1rem;
  align-items: start;
  overflow-y: auto;
}

.field-label {
  font-size: 0.8rem;
  color: #9aa3bc;
  white-space: nowrap;
  padding-top: 0.4rem;
}

.field-input {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.875rem;
  padding: 0.35rem 0.6rem;
  font-family: inherit;
  outline: none;
  width: 100%;
}
.field-input:focus { border-color: var(--accent-blue); }

.field-textarea {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.875rem;
  padding: 0.35rem 0.6rem;
  font-family: inherit;
  outline: none;
  width: 100%;
  resize: vertical;
  line-height: 1.5;
}
.field-textarea:focus { border-color: var(--accent-blue); }

.image-field {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.image-preview {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 5px;
  border: 1px solid #3d4870;
  flex-shrink: 0;
}

.image-upload-btn {
  background: #2a3150;
  border: 1px solid #3d4870;
  border-radius: 5px;
  color: #9aa3bc;
  font-size: 0.8rem;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
}
.image-upload-btn:hover { background: #313858; }

.image-file-input { display: none; }

.field-error {
  font-size: 0.8rem;
  color: var(--accent-red);
  margin: 0;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-actions-right { display: flex; gap: 0.5rem; }

.modal-cancel, .modal-confirm {
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.5rem 1.25rem;
  cursor: pointer;
}
.modal-cancel { background: #2a3150; color: #9aa3bc; border: 1px solid #3d4870; }
.modal-cancel:hover { background: #313858; }
.modal-confirm { background: var(--accent-blue); color: #fff; }
.modal-confirm:disabled { opacity: 0.6; cursor: default; }
</style>
