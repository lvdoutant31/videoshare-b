<script setup lang="ts">
import { RefreshRight } from '@element-plus/icons-vue';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import AdminShell from '../layouts/AdminShell.vue';
import { createEncryptedFetch } from '../api/crypto';
import { createAuthenticatedFetch } from '../features/auth/http';
import { createHttpRuntimeLogRepository, type RuntimeLogSnapshot } from '../features/system/runtimeLogRepository';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/videoshare';
const apiFetcher = globalThis.fetch.bind(globalThis);
const secureApiFetcher = import.meta.env.VITE_API_ENCRYPTION_ENABLED !== 'false'
  ? createEncryptedFetch(apiBaseUrl, apiFetcher)
  : apiFetcher;
const repository = createHttpRuntimeLogRepository(
  apiBaseUrl,
  createAuthenticatedFetch(secureApiFetcher),
);

const snapshot = ref<RuntimeLogSnapshot>();
const loading = ref(false);
const autoRefresh = ref(false);
const keyword = ref('');
const level = ref('ALL');
const lineCount = ref(300);
const lastUpdated = ref('');
const logContent = ref<HTMLElement>();
let timer: ReturnType<typeof setInterval> | undefined;

function lineLevel(line: string) {
  return line.match(/\b(TRACE|DEBUG|INFO|WARN|ERROR)\b/)?.[1] ?? 'OTHER';
}

const visibleLines = computed(() => (snapshot.value?.lines ?? []).filter((line) => {
  const matchesLevel = level.value === 'ALL' || lineLevel(line) === level.value;
  return matchesLevel && (!keyword.value || line.toLowerCase().includes(keyword.value.trim().toLowerCase()));
}));

function formatTime(value?: string | null) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Shanghai',
  }).format(new Date(value));
}

async function load(quiet = false) {
  if (loading.value) return;
  loading.value = true;
  try {
    snapshot.value = await repository.tail(lineCount.value);
    lastUpdated.value = new Date().toISOString();
    await nextTick();
    if (logContent.value) logContent.value.scrollTop = logContent.value.scrollHeight;
  } catch (error) {
    if (!quiet) ElMessage.error(error instanceof Error ? error.message : '读取运行日志失败');
  } finally {
    loading.value = false;
  }
}

function syncRefreshTimer() {
  if (timer) clearInterval(timer);
  timer = autoRefresh.value ? setInterval(() => void load(true), 10_000) : undefined;
}

watch(autoRefresh, syncRefreshTimer);
watch(lineCount, () => void load());
onMounted(() => void load());
onUnmounted(() => { if (timer) clearInterval(timer); });
</script>

<template>
  <AdminShell page-title="运行日志" page-subtitle="仅显示本次服务启动以来的应用日志，可选每 10 秒自动刷新">
    <section class="log-panel" aria-label="应用运行日志">
      <div class="toolbar">
        <ElSelect v-model="lineCount" aria-label="读取行数" style="width: 140px">
          <ElOption label="最近 100 行" :value="100" />
          <ElOption label="最近 300 行" :value="300" />
          <ElOption label="最近 500 行" :value="500" />
          <ElOption label="最近 1000 行" :value="1000" />
        </ElSelect>
        <ElSelect v-model="level" aria-label="日志级别" style="width: 130px">
          <ElOption label="全部级别" value="ALL" />
          <ElOption label="错误 ERROR" value="ERROR" />
          <ElOption label="警告 WARN" value="WARN" />
          <ElOption label="信息 INFO" value="INFO" />
          <ElOption label="调试 DEBUG" value="DEBUG" />
        </ElSelect>
        <ElInput v-model="keyword" placeholder="搜索日志内容" clearable style="width: 240px" />
        <ElButton :icon="RefreshRight" :loading="loading" @click="load()">刷新</ElButton>
        <ElSwitch v-model="autoRefresh" active-text="自动刷新" />
        <span class="updated">更新于 {{ formatTime(lastUpdated) }}</span>
      </div>

      <ElAlert v-if="snapshot?.truncated" type="warning" :closable="false" show-icon
        title="日志文件较大，仅展示文件末尾最近 2 MB 范围内的记录。" />
      <ElAlert v-if="snapshot && !snapshot.available" type="info" :closable="false" show-icon
        title="日志文件尚未生成，请确认应用已启动并检查服务账户对日志目录的写入权限。" />

      <div ref="logContent" v-loading="loading && !snapshot" class="log-content" data-testid="runtime-log-content">
        <div v-if="!visibleLines.length && snapshot?.available" class="empty">没有符合条件的日志</div>
        <div v-for="(line, index) in visibleLines" :key="`${index}-${line}`" class="log-line">
          <ElTag size="small" :type="lineLevel(line) === 'ERROR' ? 'danger' : lineLevel(line) === 'WARN' ? 'warning' : lineLevel(line) === 'INFO' ? 'success' : 'info'">
            {{ lineLevel(line) }}
          </ElTag>
          <code>{{ line }}</code>
        </div>
      </div>
      <div class="footer">已加载 {{ snapshot?.lines.length ?? 0 }} 行，筛选后 {{ visibleLines.length }} 行。单个日志文件最多 20 MB。</div>
    </section>
  </AdminShell>
</template>

<style scoped>
.log-panel { display: flex; flex-direction: column; gap: 14px; }
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.updated { margin-left: auto; color: var(--el-text-color-secondary); font-size: 12px; }
.log-content { min-height: 280px; max-height: calc(100vh - 300px); overflow: auto; padding: 12px; background: #111827; border-radius: 8px; }
.log-line { display: flex; align-items: flex-start; gap: 10px; min-height: 26px; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
.log-line code { color: #e5e7eb; font: 12px/1.6 Consolas, 'Microsoft YaHei', monospace; white-space: pre-wrap; word-break: break-all; }
.empty { padding: 36px 12px; color: #cbd5e1; text-align: center; }
.footer { color: var(--el-text-color-secondary); font-size: 12px; }
@media (max-width: 760px) { .updated { width: 100%; margin-left: 0; } .log-content { max-height: 65vh; } }
</style>
