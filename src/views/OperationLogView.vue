<script setup lang="ts">
import { RefreshRight } from '@element-plus/icons-vue';
import { computed, onMounted, reactive, ref } from 'vue';
import AdminShell from '../layouts/AdminShell.vue';
import { createHttpSystemRepository } from '../features/system/repository';
import type { OperationLog, OperationLogQuery } from '../features/system/model';
import { actionLabels, moduleLabels } from '../features/system/model';

const repository = createHttpSystemRepository();

const logs = ref<OperationLog[]>([]);
const total = ref(0);
const loading = ref(true);
const refreshing = ref(false);
const query = reactive<OperationLogQuery>({ page: 1, pageSize: 20 });
let requestId = 0;

const detailOpen = ref(false);
const detailItem = ref<OperationLog>();

const parsedParams = computed(() => {
  if (!detailItem.value?.requestParams) return null;
  try { return JSON.parse(detailItem.value.requestParams); } catch { return null; }
});

function formatTime(value: string | null) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).format(new Date(value));
}

function moduleLabel(m: string) { return moduleLabels[m] ?? m; }
function actionLabel(a: string) { return actionLabels[a] ?? a; }
function statusType(s: string) { return s === 'SUCCESS' ? 'success' : 'danger'; }

function showDetail(row: OperationLog) {
  detailItem.value = row;
  detailOpen.value = true;
}

async function load() {
  const currentRequest = ++requestId;
  const initial = !logs.value.length;
  loading.value = initial;
  refreshing.value = !initial;
  try {
    const result = await repository.list(query);
    if (currentRequest !== requestId) return;
    logs.value = result.items;
    total.value = result.total;
  } catch {
    if (currentRequest !== requestId) return;
  } finally {
    if (currentRequest === requestId) {
      loading.value = false;
      refreshing.value = false;
    }
  }
}

function search() { query.page = 1; void load(); }
function reset() { Object.assign(query, { page: 1, module: undefined, action: undefined, actorId: undefined, status: undefined }); void load(); }
function changePage(p: number) { query.page = p; void load(); }

onMounted(load);
</script>

<template>
  <AdminShell title="操作日志">
    <div class="toolbar">
      <ElSelect v-model="query.module" placeholder="模块" clearable style="width: 140px" @change="search">
        <ElOption v-for="(label, key) in moduleLabels" :key="key" :label="label" :value="key" />
      </ElSelect>
      <ElSelect v-model="query.status" placeholder="状态" clearable style="width: 120px" @change="search">
        <ElOption label="成功" value="SUCCESS" />
        <ElOption label="失败" value="FAILURE" />
      </ElSelect>
      <ElInput v-model="query.actorId" placeholder="操作者 ID" clearable style="width: 140px" @keyup.enter="search" @clear="search" />
      <ElButton @click="reset">重置</ElButton>
      <span class="spacer" />
      <ElButton :icon="RefreshRight" :loading="refreshing" circle @click="load" />
    </div>

    <ElTable :data="logs" v-loading="loading" stripe>
      <ElTableColumn label="时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </ElTableColumn>
      <ElTableColumn label="操作者" prop="actorName" width="120" />
      <ElTableColumn label="模块" width="110">
        <template #default="{ row }">{{ moduleLabel(row.module) }}</template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="120">
        <template #default="{ row }">{{ actionLabel(row.action) }}</template>
      </ElTableColumn>
      <ElTableColumn label="目标" min-width="160">
        <template #default="{ row }">
          <span v-if="row.targetId">{{ row.targetType }} #{{ row.targetId }}</span>
          <span v-else>{{ row.targetType }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="详情" prop="detail" min-width="200" show-overflow-tooltip />
      <ElTableColumn label="IP" prop="ip" width="140" show-overflow-tooltip />
      <ElTableColumn label="状态" width="80" align="center">
        <template #default="{ row }">
          <ElTag :type="statusType(row.status)" size="small">{{ row.status === 'SUCCESS' ? '成功' : '失败' }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="耗时" width="90" align="right">
        <template #default="{ row }">{{ row.durationMs }}ms</template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="80" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" size="small" @click="showDetail(row)">详情</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="pagination">
      <ElPagination background layout="prev, pager, next, total" :total="total" :page-size="query.pageSize"
        :current-page="query.page" @current-change="changePage" />
    </div>

    <!-- Detail Drawer -->
    <ElDrawer v-model="detailOpen" title="操作详情" size="520px" direction="rtl">
      <template v-if="detailItem">
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem label="操作者">{{ detailItem.actorName }} (ID: {{ detailItem.actorId }})</ElDescriptionsItem>
          <ElDescriptionsItem label="模块">{{ moduleLabel(detailItem.module) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="操作">{{ actionLabel(detailItem.action) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="目标">
            <span v-if="detailItem.targetId">{{ detailItem.targetType }} #{{ detailItem.targetId }}</span>
            <span v-else>{{ detailItem.targetType }}</span>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="描述">{{ detailItem.detail ?? '--' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="状态">
            <ElTag :type="statusType(detailItem.status)" size="small">{{ detailItem.status === 'SUCCESS' ? '成功' : '失败' }}</ElTag>
            <span v-if="detailItem.errorCode" style="margin-left: 8px; color: var(--el-color-danger)">({{ detailItem.errorCode }})</span>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="耗时">{{ detailItem.durationMs }}ms</ElDescriptionsItem>
          <ElDescriptionsItem label="IP">{{ detailItem.ip ?? '--' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="时间">{{ formatTime(detailItem.createdAt) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="Trace ID">{{ detailItem.traceId }}</ElDescriptionsItem>
        </ElDescriptions>

        <h4 style="margin: 20px 0 10px">请求信息</h4>
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem label="方法">
            <ElTag size="small" type="info">{{ detailItem.requestMethod }}</ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="路径">
            <code class="request-path">{{ detailItem.requestPath }}</code>
          </ElDescriptionsItem>
        </ElDescriptions>

        <template v-if="parsedParams">
          <h4 style="margin: 20px 0 10px">请求参数</h4>
          <div class="params-section">
            <template v-if="parsedParams.pathVariables">
              <div class="param-group">
                <span class="param-label">路径变量</span>
                <pre class="param-json">{{ JSON.stringify(parsedParams.pathVariables, null, 2) }}</pre>
              </div>
            </template>
            <template v-if="parsedParams.queryParams">
              <div class="param-group">
                <span class="param-label">查询参数</span>
                <pre class="param-json">{{ JSON.stringify(parsedParams.queryParams, null, 2) }}</pre>
              </div>
            </template>
            <template v-if="parsedParams.requestBody">
              <div class="param-group">
                <span class="param-label">请求体</span>
                <pre class="param-json">{{ JSON.stringify(parsedParams.requestBody, null, 2) }}</pre>
              </div>
            </template>
          </div>
        </template>
        <template v-else-if="detailItem.requestParams">
          <h4 style="margin: 20px 0 10px">请求参数</h4>
          <pre class="param-json">{{ detailItem.requestParams }}</pre>
        </template>
      </template>
    </ElDrawer>
  </AdminShell>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.spacer { flex: 1; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }

.request-path { font-size: 12px; word-break: break-all; color: var(--el-color-primary); }
.params-section { display: flex; flex-direction: column; gap: 12px; }
.param-group { display: flex; flex-direction: column; gap: 4px; }
.param-label { font-size: 12px; color: var(--el-text-color-secondary); font-weight: 500; }
.param-json {
  margin: 0;
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
