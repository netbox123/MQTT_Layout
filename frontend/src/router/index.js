import { createRouter, createWebHistory } from 'vue-router';
import DashboardPage from '../views/DashboardPage.vue';
import MobilePage from '../views/MobilePage.vue';
import RemotePage from '../views/RemotePage.vue';
import WledPage from '../views/WledPage.vue';
import NotFound from '../views/NotFound.vue';

export function createPageRoute(config) {
  return {
    path: config.path,
    name: config.name,
    component: DashboardPage,
    props: { pageConfig: config },
  };
}

export async function createAppRouter() {
  const response = await fetch('/api/pages');
  if (!response.ok) {
    throw new Error(`Failed to fetch page configs: ${response.statusText}`);
  }
  const pageConfigs = await response.json();

  const routes = pageConfigs.map(createPageRoute);

  // Redirect root to first page
  if (pageConfigs.length > 0) {
    routes.push({ path: '/', redirect: pageConfigs[0].path });
  }

  routes.push({ path: '/remote', component: RemotePage });
  routes.push({ path: '/wled', component: WledPage });
  routes.push({ path: '/m/:slug', component: MobilePage });

  const firstMobile = pageConfigs
    .filter(p => p.mobile !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
  if (firstMobile) {
    routes.push({ path: '/mobile', redirect: '/m' + firstMobile.path });
  }

  routes.push({ path: '/:pathMatch(.*)*', component: NotFound });

  return {
    router: createRouter({ history: createWebHistory(), routes }),
    pageConfigs,
  };
}
