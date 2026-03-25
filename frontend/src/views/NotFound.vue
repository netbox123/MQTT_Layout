<template>
  <div class="not-found">
    <span class="code">404</span>
    <p>Page not found</p>
    <router-link to="/" class="back-link">Go to dashboard</router-link>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
  color: var(--text-secondary);
}

.code {
  font-size: 4rem;
  font-weight: 700;
  color: var(--text-muted);
}

.back-link {
  color: var(--accent-blue);
  font-size: 0.9rem;
}
</style>
