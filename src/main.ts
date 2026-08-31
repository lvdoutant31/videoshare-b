import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import { router } from './router';
import { dashboardRepositoryKey, createHttpDashboardRepository } from './features/dashboard/repository';
import { taxonomyRepositoryKey, createHttpTaxonomyRepository } from './features/taxonomy/repository';
import { videoRepositoryKey, createHttpVideoRepository } from './features/video/repository';
import { reviewRepositoryKey, createHttpReviewRepository } from './features/review/repository';
import { userRepositoryKey, createHttpUserRepository } from './features/user/repository';
import { commentReportRepositoryKey, createHttpCommentReportRepository } from './features/comment-report/repository';
import { authState, createAdminAuthRepository } from './features/auth/repository';
import './styles/index.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
const dashboardRepository = createHttpDashboardRepository(apiBaseUrl);
const taxonomyRepository = createHttpTaxonomyRepository(apiBaseUrl);
const videoRepository = createHttpVideoRepository(apiBaseUrl);
const reviewRepository = createHttpReviewRepository(apiBaseUrl);
const userRepository = createHttpUserRepository(apiBaseUrl);
const commentReportRepository = createHttpCommentReportRepository(apiBaseUrl);
const authRepository = createAdminAuthRepository(apiBaseUrl);

async function bootstrapAuth() {
  try {
    authState.session = await authRepository.session();
  } catch {
    authState.session = null;
  }
  authState.loading = false;
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
    .provide(commentReportRepositoryKey, commentReportRepository)
    .mount('#app');
});
