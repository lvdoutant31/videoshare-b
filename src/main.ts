import { createApp, watch } from 'vue';
import ElementPlus, { ElMessage } from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import { router } from './router';
import { dashboardRepositoryKey, createHttpDashboardRepository } from './features/dashboard/repository';
import { taxonomyRepositoryKey, createHttpTaxonomyRepository } from './features/taxonomy/repository';
import { videoRepositoryKey, createHttpVideoRepository } from './features/video/repository';
import { reviewRepositoryKey, createHttpReviewRepository } from './features/review/repository';
import { userRepositoryKey, createHttpUserRepository } from './features/user/repository';
import { adminRepositoryKey, createHttpAdminRepository } from './features/admin/repository';
import { commentReportRepositoryKey, createHttpCommentReportRepository } from './features/comment-report/repository';
import { authState, createAdminAuthRepository } from './features/auth/repository';
import { createAuthenticatedFetch, isSessionInvalid, sanitizeRedirect, setUnauthorizedHandler } from './features/auth/http';
import './styles/index.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/videoshare';
const SESSION_POLL_INTERVAL_MS = 5 * 60 * 1000;
const AUTH_CHANNEL_NAME = 'yingliu-admin-auth';

let redirecting = false;

/**
 * 会话失效的统一出口：清空本地登录态并跳转登录页，保留回跳地址。
 *
 * 单飞标志是必要的——页面并发发起多个请求时，每个 401 都会走到这里，
 * 不加控制会产生多次 router.replace 并互相覆盖回跳地址。
 */
function handleSessionInvalid() {
  const hadSession = authState.session !== null;
  authState.session = null;
  if (redirecting || router.currentRoute.value.name === 'login') return;
  redirecting = true;
  const redirect = sanitizeRedirect(router.currentRoute.value.fullPath);
  if (hadSession) {
    // 首次进入本就没有会话时不提示"已过期"，避免误导。
    ElMessage.warning('登录已过期，请重新登录');
  }
  void router
    .replace({ name: 'login', query: { redirect, reason: 'expired' } })
    .finally(() => { redirecting = false; });
}

setUnauthorizedHandler(handleSessionInvalid);

// 所有业务 repository 共用同一包装：凭证与会话失效处理在此收口。
const authenticatedFetch = createAuthenticatedFetch();
const dashboardRepository = createHttpDashboardRepository(apiBaseUrl, authenticatedFetch);
const taxonomyRepository = createHttpTaxonomyRepository(apiBaseUrl, authenticatedFetch);
const videoRepository = createHttpVideoRepository(apiBaseUrl, authenticatedFetch);
const reviewRepository = createHttpReviewRepository(apiBaseUrl, authenticatedFetch);
const userRepository = createHttpUserRepository(apiBaseUrl, authenticatedFetch);
const adminRepository = createHttpAdminRepository(apiBaseUrl, authenticatedFetch);
const commentReportRepository = createHttpCommentReportRepository(apiBaseUrl, authenticatedFetch);
// 登录与会话探测使用原始 fetch：它们自身就是会话状态的来源，不应再触发跳转。
const authRepository = createAdminAuthRepository(apiBaseUrl);

async function bootstrapAuth() {
  try {
    authState.session = await authRepository.session();
  } catch {
    authState.session = null;
  }
  authState.loading = false;
}

/**
 * 会话巡检：既让停留在不发请求页面上的用户及时回到登录页，
 * 也顺带刷新 session 中剩余有效期，供界面做临期提示。
 */
function startSessionWatchdog() {
  window.setInterval(async () => {
    if (!authState.session) return;
    try {
      authState.session = await authRepository.session();
    } catch (cause) {
      // 只有确认会话失效才登出；网络抖动不应把用户踢回登录页。
      if (isSessionInvalid(cause)) handleSessionInvalid();
    }
  }, SESSION_POLL_INTERVAL_MS);
}

/** 跨标签页同步：一个标签页退出登录后，其它标签页立即回到登录页，而不是等下次请求失败。 */
function startCrossTabSync() {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
  watch(() => authState.session, (session, previous) => {
    // 仅在"有会话 → 无会话"的跃迁上广播；收到广播的标签页此时已是 null，不会再回传，不会形成循环。
    if (previous && !session) channel.postMessage('logout');
  });
  channel.addEventListener('message', (event) => {
    if (event.data !== 'logout') return;
    authState.session = null;
    if (router.currentRoute.value.name !== 'login') {
      void router.replace({ name: 'login', query: { reason: 'logout' } });
    }
  });
}

bootstrapAuth().finally(() => {
  createApp(App)
    .use(ElementPlus)
    .use(router)
    .provide(dashboardRepositoryKey, dashboardRepository)
    .provide(taxonomyRepositoryKey, taxonomyRepository)
    .provide(videoRepositoryKey, videoRepository)
    .provide(reviewRepositoryKey, reviewRepository)
    .provide(userRepositoryKey, userRepository)
    .provide(adminRepositoryKey, adminRepository)
    .provide(commentReportRepositoryKey, commentReportRepository)
    .mount('#app');
  startSessionWatchdog();
  startCrossTabSync();
});
