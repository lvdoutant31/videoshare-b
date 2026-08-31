import { createRouter, createWebHistory } from 'vue-router';
import { authState } from './features/auth/repository';

export const router = createRouter({
  history: createWebHistory('/admin/'),
  routes: [
    { path: '/login', name: 'login', component: () => import('./views/AdminLoginView.vue'), meta: { public: true } },
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: () => import('./views/DashboardView.vue') },
    { path: '/videos', name: 'videos', component: () => import('./views/VideoManagementView.vue') },
    { path: '/reviews', name: 'reviews', component: () => import('./views/VideoReviewManagementView.vue') },
    { path: '/users', name: 'users', component: () => import('./views/UserManagementView.vue') },
    { path: '/comments', name: 'comments', component: () => import('./views/CommentReportManagementView.vue'), props: { resource: 'comments' } },
    { path: '/reports', name: 'reports', component: () => import('./views/CommentReportManagementView.vue'), props: { resource: 'reports' } },
    { path: '/system', redirect: '/system/categories' },
    { path: '/system/categories', name: 'categories', component: () => import('./views/TaxonomyManagementView.vue'), props: { resource: 'categories' } },
    { path: '/system/tags', name: 'tags', component: () => import('./views/TaxonomyManagementView.vue'), props: { resource: 'tags' } },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
  ]
});

router.beforeEach((to) => {
  if (to.meta.public || authState.loading || authState.session) return true;
  return { name: 'login', query: { redirect: to.fullPath } };
});
