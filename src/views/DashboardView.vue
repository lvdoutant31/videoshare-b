<script setup lang="ts">
import { RefreshRight, WarningFilled } from '@element-plus/icons-vue';
import { inject, onMounted, ref } from 'vue';
import MetricCard from '../features/dashboard/components/MetricCard.vue';
import RecentVideosTable from '../features/dashboard/components/RecentVideosTable.vue';
import StoragePanel from '../features/dashboard/components/StoragePanel.vue';
import TodoPanel from '../features/dashboard/components/TodoPanel.vue';
import TrendPanel from '../features/dashboard/components/TrendPanel.vue';
import type { DashboardRange, DashboardRepository, DashboardSnapshot } from '../features/dashboard/model';
import { DashboardLoadError, dashboardRepositoryKey } from '../features/dashboard/repository';
import AdminShell from '../layouts/AdminShell.vue';

const injectedRepository = inject<DashboardRepository>(dashboardRepositoryKey);
if (!injectedRepository) throw new Error('Dashboard repository is not configured');
const repository: DashboardRepository = injectedRepository;

const range = ref<DashboardRange>('7d');
const snapshot = ref<DashboardSnapshot>();
const loading = ref(true);
const refreshing = ref(false);
const error = ref<{ message: string; traceId?: string }>();
let requestId = 0;

async function loadSnapshot(nextRange = range.value) {
  const currentRequest = ++requestId;
  const isInitialLoad = !snapshot.value;
  loading.value = isInitialLoad;
  refreshing.value = !isInitialLoad;
  error.value = undefined;

  try {
    const result = await repository.getSnapshot(nextRange);
    if (currentRequest !== requestId) return;
    snapshot.value = result;
  } catch (caught) {
    if (currentRequest !== requestId) return;
    if (caught instanceof DashboardLoadError) {
      error.value = { message: caught.message, traceId: caught.traceId };
    } else {
      error.value = { message: '工作台数据暂时不可用，请稍后重试。' };
    }
  } finally {
    if (currentRequest === requestId) {
      loading.value = false;
      refreshing.value = false;
    }
  }
}

function updateRange(nextRange: DashboardRange) {
  if (range.value === nextRange) return;
  range.value = nextRange;
  void loadSnapshot(nextRange);
}

onMounted(() => { void loadSnapshot(); });
</script>

<template>
  <AdminShell :updated-at="snapshot?.updatedAt">
    <section v-if="loading" class="dashboard-skeleton" aria-label="正在加载工作台">
      <el-skeleton :rows="2" animated /><div class="skeleton-metrics"><el-skeleton v-for="item in 4" :key="item" animated><template #template><el-skeleton-item variant="rect" style="height: 126px" /></template></el-skeleton></div><el-skeleton :rows="9" animated />
    </section>

    <section v-else-if="!snapshot" class="dashboard-error" role="alert">
      <el-icon><WarningFilled /></el-icon><h2>工作台加载失败</h2><p>{{ error?.message ?? '工作台数据暂时不可用，请稍后重试。' }}</p><small v-if="error?.traceId">诊断编号：{{ error.traceId }}</small><el-button type="primary" :icon="RefreshRight" @click="loadSnapshot()">重新加载</el-button>
    </section>

    <div v-else class="dashboard">
      <div class="dashboard-intro"><div><h2>运营概览</h2><p>内容、用户和媒体服务的实时运行状态</p></div><el-button :icon="RefreshRight" :loading="refreshing" plain @click="loadSnapshot()">刷新数据</el-button></div>
      <div v-if="error" class="refresh-error" role="status"><el-icon><WarningFilled /></el-icon><span>{{ error.message }}</span><small v-if="error.traceId">诊断编号：{{ error.traceId }}</small><button type="button" @click="loadSnapshot()">重试</button></div>
      <div class="metric-grid"><MetricCard v-for="metric in snapshot.metrics" :key="metric.key" :metric="metric" /></div>
      <div class="dashboard-main"><TrendPanel :trend="snapshot.trend" :loading="refreshing" @update:range="updateRange" /><div class="dashboard-side"><TodoPanel :todos="snapshot.todos" /><StoragePanel :storage="snapshot.storage" /></div></div>
      <RecentVideosTable :videos="snapshot.recentVideos" />
    </div>
  </AdminShell>
</template>

<style scoped>
.dashboard { display: grid; gap: 18px; }.dashboard-intro { display: flex; align-items: flex-end; justify-content: space-between; }.dashboard-intro h2 { margin: 0; color: var(--yl-text); font-size: 20px; font-weight: 730; }.dashboard-intro p { margin: 6px 0 0; color: var(--yl-text-muted); font-size: 12px; }.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }.dashboard-main { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(300px, 0.8fr); gap: 18px; }.dashboard-side { display: grid; gap: 18px; }.dashboard-skeleton { display: grid; gap: 18px; }.skeleton-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }.dashboard-error { display: grid; justify-items: center; max-width: 560px; margin: 80px auto; padding: 38px; color: var(--yl-text-secondary); text-align: center; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.dashboard-error .el-icon { color: var(--yl-coral); font-size: 30px; }.dashboard-error h2 { margin: 12px 0 0; color: var(--yl-text); font-size: 18px; }.dashboard-error p { margin: 8px 0; font-size: 13px; }.dashboard-error small { margin-bottom: 18px; color: var(--yl-text-muted); }.refresh-error { display: flex; align-items: center; gap: 7px; padding: 10px 12px; color: #9f3b42; background: #fff6f6; border: 1px solid #f7d6d8; border-radius: 6px; font-size: 12px; }.refresh-error small { color: #a87377; }.refresh-error button { margin-left: auto; padding: 0; color: #9f3b42; background: transparent; border: 0; font-size: 12px; text-decoration: underline; cursor: pointer; }
</style>
