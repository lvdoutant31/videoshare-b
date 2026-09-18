import { createRouter, createWebHistory } from 'vue-router';
import { authState } from './features/auth/repository';
import { hasPermission } from './features/auth/permissions';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    permission?: string;
  }
}

export const router = createRouter({
  history: createWebHistory('/videoshare/admin/'),
  routes: [
    { path: '/login', name: 'login', component: () => import('./views/AdminLoginView.vue'), meta: { public: true } },
    // 403 必须公开：已登录但权限不足的用户会被守卫送到这里，若它自身再要求权限就会死循环。
    { path: '/403', name: 'forbidden', component: () => import('./views/ForbiddenView.vue'), meta: { public: true } },
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: () => import('./views/DashboardView.vue'), meta: { permission: 'dashboard:view' } },
    { path: '/videos', name: 'videos', component: () => import('./views/VideoManagementView.vue'), meta: { permission: 'video:view' } },
    { path: '/oss-upload-test', name: 'oss-upload-test', component: () => import('./views/OssUploadTestView.vue'), meta: { permission: 'oss-test:upload' } },
    { path: '/reviews', name: 'reviews', component: () => import('./views/VideoReviewManagementView.vue'), meta: { permission: 'review:view' } },
    { path: '/users', name: 'users', component: () => import('./views/UserManagementView.vue'), meta: { permission: 'user:view' } },
    { path: '/admins', name: 'admins', component: () => import('./views/AdminManagementView.vue'), meta: { permission: 'admin:view' } },
    { path: '/comments', name: 'comments', component: () => import('./views/CommentReportManagementView.vue'), props: { resource: 'comments' }, meta: { permission: 'comment:view' } },
    { path: '/reports', name: 'reports', component: () => import('./views/CommentReportManagementView.vue'), props: { resource: 'reports' }, meta: { permission: 'report:view' } },
    { path: '/system', redirect: '/system/categories' },
    { path: '/system/categories', name: 'categories', component: () => import('./views/TaxonomyManagementView.vue'), props: { resource: 'categories' }, meta: { permission: 'category:view' } },
    { path: '/system/tags', name: 'tags', component: () => import('./views/TaxonomyManagementView.vue'), props: { resource: 'tags' }, meta: { permission: 'tag:view' } },
    { path: '/system/operation-logs', name: 'operationLogs', component: () => import('./views/OperationLogView.vue'), meta: { permission: 'operation-log:view' } },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
  ]
});

/**
 * 路由守卫：
 * - 未登录访问受保护页面 → 跳登录页并记录回跳地址与原因
 * - 已登录但缺少页面所需权限 → 跳 403（不跳登录页，否则会与"会话失效"混淆）
 */
router.beforeEach((to) => {
  if (to.meta.public || authState.loading) return true;
  if (!authState.session) {
    return { name: 'login', query: { redirect: to.fullPath, reason: 'required' } };
  }
  // 每条受保护路由都声明了 meta.permission，此前只校验了登录态，权限未在路由层生效。
  if (!hasPermission(to.meta.permission)) {
    return { name: 'forbidden' };
  }
  return true;
});
