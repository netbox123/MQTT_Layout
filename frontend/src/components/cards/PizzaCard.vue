<template>
  <div class="card pizza-card" @click.self="blur">
    <button v-if="props.mobile && anyFocused" class="done-btn" @click="blur">Done</button>
    <div :class="['pizza-layout', { 'pizza-layout--mobile': props.mobile }]">
      <!-- titles span their half -->
      <div class="pizza-title span-left">Pizza dough</div>
      <div class="pizza-title span-right">Ingredients</div>

      <!-- row 1 -->
      <label class="field-label">Pizzas</label>
      <input class="field-input" type="number" v-model.number="count" min="1" max="20" @focus="anyFocused=true" @blur="anyFocused=false" />
      <span class="result-label">Flour</span>
      <span class="result-value">{{ flour }}<span class="result-unit"> gr.</span></span>

      <!-- row 2 -->
      <label class="field-label">Weight (g)</label>
      <input class="field-input" type="number" v-model.number="weight" min="100" max="500" @focus="anyFocused=true" @blur="anyFocused=false" />
      <span class="result-label">Water</span>
      <span class="result-value">{{ water }}<span class="result-unit"> gr.</span></span>

      <!-- row 3 -->
      <label class="field-label">Hydration%</label>
      <input class="field-input" type="number" v-model.number="hydration" min="50" max="90" @focus="anyFocused=true" @blur="anyFocused=false" />
      <span class="result-label">Salt</span>
      <span class="result-value">{{ saltGrams }}<span class="result-unit"> gr.</span></span>

      <!-- row 4 -->
      <label class="field-label">Salt (%)</label>
      <input class="field-input" type="number" v-model.number="salt" min="0" max="5" step="0.1" @focus="anyFocused=true" @blur="anyFocused=false" />
      <span class="result-label result-label--total">Total</span>
      <span class="result-value result-value--total">{{ total }}<span class="result-unit"> gr.</span></span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({ card: Object, mobile: Boolean });
const anyFocused = ref(false);

function blur() {
  document.activeElement?.blur();
  anyFocused.value = false;
}

const count     = ref(2);
const weight    = ref(200);
const hydration = ref(65);
const salt      = ref(2.5);

const total = computed(() => Math.round(count.value * weight.value));

const flour = computed(() => {
  const divisor = 1 + hydration.value / 100 + salt.value / 100;
  return Math.round(total.value / divisor);
});

const water     = computed(() => Math.round(flour.value * hydration.value / 100));
const saltGrams = computed(() => Math.round(flour.value * salt.value / 100 * 10) / 10);
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem;
  overflow: hidden;
}

.done-btn {
  position: absolute;
  top: 0.4rem;
  right: 0.6rem;
  background: var(--accent-blue, #3b82f6);
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  font-family: inherit;
  z-index: 10;
}

.pizza-card {
  position: relative;
}

/* 4-column grid: [left-label] [left-input] [right-label] [right-value] */
.pizza-layout {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
  column-gap: 0.5rem;
  row-gap: 0.5rem;
  align-items: center;
  padding-right: 2rem;
  max-width: 400px;
}

.span-left  { grid-column: 1 / 3; }
.span-right { grid-column: 3 / 5; }

.pizza-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* add extra gap between the two halves */
.result-label, .result-value {
  margin-left: 2rem;
}
.span-right {
  margin-left: 2rem;
}

.field-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.field-input {
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.95rem;
  padding: 0.3rem 0.5rem;
  width: 100%;
  box-sizing: border-box;
}

.field-input:focus {
  outline: none;
  border-color: var(--accent-blue, #3b82f6);
}

.result-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.result-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
}

.result-value--total {
  font-weight: 700;
}

.result-unit {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-secondary);
  margin-left: 0.15rem;
}

/* Mobile: stack inputs above results */
.pizza-layout--mobile {
  grid-template-columns: auto minmax(0, 1fr);
  padding-right: 0;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}

.pizza-layout--mobile .span-left  { grid-column: 1/3; grid-row: 1; }
.pizza-layout--mobile .span-right { grid-column: 1/3; grid-row: 7; margin-left: 0; }

.pizza-layout--mobile > :nth-child(3)  { grid-row: 2; grid-column: 1; }
.pizza-layout--mobile > :nth-child(4)  { grid-row: 2; grid-column: 2; }
.pizza-layout--mobile > :nth-child(7)  { grid-row: 3; grid-column: 1; }
.pizza-layout--mobile > :nth-child(8)  { grid-row: 3; grid-column: 2; }
.pizza-layout--mobile > :nth-child(11) { grid-row: 4; grid-column: 1; }
.pizza-layout--mobile > :nth-child(12) { grid-row: 4; grid-column: 2; }
.pizza-layout--mobile > :nth-child(15) { grid-row: 5; grid-column: 1; }
.pizza-layout--mobile > :nth-child(16) { grid-row: 5; grid-column: 2; }

.pizza-layout--mobile > :nth-child(5)  { grid-row: 8;  grid-column: 1; margin-left: 0; }
.pizza-layout--mobile > :nth-child(6)  { grid-row: 8;  grid-column: 2; margin-left: 0; }
.pizza-layout--mobile > :nth-child(9)  { grid-row: 9;  grid-column: 1; margin-left: 0; }
.pizza-layout--mobile > :nth-child(10) { grid-row: 9;  grid-column: 2; margin-left: 0; }
.pizza-layout--mobile > :nth-child(13) { grid-row: 10; grid-column: 1; margin-left: 0; }
.pizza-layout--mobile > :nth-child(14) { grid-row: 10; grid-column: 2; margin-left: 0; }
.pizza-layout--mobile > :nth-child(17) { grid-row: 11; grid-column: 1; margin-left: 0; }
.pizza-layout--mobile > :nth-child(18) { grid-row: 11; grid-column: 2; margin-left: 0; }
</style>
