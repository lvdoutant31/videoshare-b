<script setup lang="ts">
import { EditPen, Plus, RefreshRight } from '@element-plus/icons-vue';
import { computed, inject, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AdminShell from '../layouts/AdminShell.vue';
import type { Category, CategoryInput, PageQuery, ResourceStatus, Tag, TagInput, TaxonomyRepository } from '../features/taxonomy/model';
import { TaxonomyError, taxonomyRepositoryKey } from '../features/taxonomy/repository';

const props = defineProps<{ resource: 'categories' | 'tags' }>();
const injectedRepository = inject<TaxonomyRepository>(taxonomyRepositoryKey);
if (!injectedRepository) throw new Error('Taxonomy repository is not configured');
const repository: TaxonomyRepository = injectedRepository;

const isCategory = computed(() => props.resource === 'categories');
const title = computed(() => isCategory.value ? '分类管理' : '标签管理');
const description = computed(() => isCategory.value ? '维护内容分类与展示顺序' : '维护内容标签与热度排序');
const items = ref<(Category | Tag)[]>([]);
const total = ref(0);
const loading = ref(true);
const refreshing = ref(false);
const error = ref<{ message: string; traceId?: string }>();
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '', status: undefined });
const editorOpen = ref(false);
const submitting = ref(false);
const editing = ref<Category | Tag>();
const form = reactive<{ name: string; icon: string; sort: number; heatScore: number; status: ResourceStatus }>({ name: '', icon: '', sort: 0, heatScore: 0, status: 'ENABLED' });
const rowLoading = ref<string>();
let requestId = 0;

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).format(new Date(value));
}

async function load() {
  const currentRequest = ++requestId;
  const initial = !items.value.length;
  loading.value = initial;
  refreshing.value = !initial;
  error.value = undefined;
  try {
    const result = isCategory.value ? await repository.listCategories(query) : await repository.listTags(query);
    if (currentRequest !== requestId) return;
    items.value = result.items;
    total.value = result.total;
  } catch (caught) {
    if (currentRequest !== requestId) return;
    const typed = caught instanceof TaxonomyError ? caught : undefined;
    error.value = { message: typed?.message ?? '数据暂时不可用，请稍后重试。', traceId: typed?.traceId };
  } finally {
    if (currentRequest === requestId) {
      loading.value = false;
      refreshing.value = false;
    }
  }
}

function search() { query.page = 1; void load(); }
function reset() { query.keyword = ''; query.status = undefined; query.page = 1; void load(); }
function openCreate() { editing.value = undefined; Object.assign(form, { name: '', icon: '', sort: 0, heatScore: 0, status: 'ENABLED' }); editorOpen.value = true; }
function openEdit(item: Category | Tag) {
  editing.value = item;
  Object.assign(form, { name: item.name, icon: isCategory.value ? (item as Category).icon ?? '' : '', sort: isCategory.value ? (item as Category).sort : 0, heatScore: isCategory.value ? 0 : (item as Tag).heatScore, status: item.status });
  editorOpen.value = true;
}

async function save() {
  const name = form.name.trim();
  if (!name || name.length > 64) return ElMessage.error('请输入 1 至 64 个字符的名称');
  if (isCategory.value && (!Number.isInteger(form.sort) || form.sort < 0)) return ElMessage.error('排序必须是非负整数');
  if (!isCategory.value && (!Number.isFinite(form.heatScore) || form.heatScore < 0)) return ElMessage.error('热度必须是非负数');
  submitting.value = true;
  try {
    if (isCategory.value) {
      const input: CategoryInput = { name, icon: form.icon.trim() || null, sort: form.sort, status: form.status };
      editing.value ? await repository.updateCategory(editing.value.id, input) : await repository.createCategory(input);
    } else {
      const input: TagInput = { name, heatScore: form.heatScore, status: form.status };
      editing.value ? await repository.updateTag(editing.value.id, input) : await repository.createTag(input);
    }
    ElMessage.success(editing.value ? '已保存修改' : '已创建');
    editorOpen.value = false;
    query.page = editing.value ? query.page : 1;
    await load();
  } catch (caught) { ElMessage.error(caught instanceof Error ? caught.message : '保存失败'); }
  finally { submitting.value = false; }
}

async function toggle(item: Category | Tag) {
  rowLoading.value = item.id;
  try {
    const status: ResourceStatus = item.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    if (isCategory.value) await repository.updateCategory(item.id, { status }); else await repository.updateTag(item.id, { status });
    await load();
  } catch (caught) { ElMessage.error(caught instanceof Error ? caught.message : '状态更新失败'); }
  finally { rowLoading.value = undefined; }
}

async function remove(item: Category | Tag) {
  try {
    await ElMessageBox.confirm(`删除后不可恢复。已被内容引用的${isCategory.value ? '分类' : '标签'}无法删除，可改为停用。`, `删除${item.name}`, { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
    rowLoading.value = item.id;
    if (isCategory.value) await repository.deleteCategory(item.id); else await repository.deleteTag(item.id);
    if (items.value.length === 1 && query.page > 1) query.page--;
    await load();
    ElMessage.success('已删除');
  } catch (caught) {
    if (caught !== 'cancel' && caught !== 'close') ElMessage.error(caught instanceof Error ? caught.message : '删除失败，请改为停用');
  } finally { rowLoading.value = undefined; }
}

onMounted(() => { void load(); });
watch(() => props.resource, () => {
  editorOpen.value = false;
  editing.value = undefined;
  query.keyword = '';
  query.status = undefined;
  query.page = 1;
  items.value = [];
  total.value = 0;
  void load();
});
</script>

<template>
  <AdminShell :page-title="title" :page-subtitle="description">
    <section class="management-page">
      <header class="page-header"><div><h2>{{ title }}</h2><p>{{ description }}</p></div><el-button type="primary" :icon="Plus" @click="openCreate">新建{{ isCategory ? '分类' : '标签' }}</el-button></header>
      <div class="filters"><el-input v-model="query.keyword" placeholder="搜索名称" clearable @keyup.enter="search" /><el-select v-model="query.status" placeholder="全部状态" clearable><el-option label="已启用" value="ENABLED" /><el-option label="已停用" value="DISABLED" /></el-select><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></div>
      <div v-if="error && !items.length" class="error-state"><p>{{ error.message }}</p><small v-if="error.traceId">诊断编号：{{ error.traceId }}</small><el-button :icon="RefreshRight" @click="load">重试</el-button></div>
      <section v-else class="table-shell" v-loading="loading || refreshing"><div v-if="error" class="inline-error">{{ error.message }} <small v-if="error.traceId">诊断编号：{{ error.traceId }}</small><button type="button" @click="load">重试</button></div>
        <el-table :data="items" empty-text="没有匹配的记录" table-layout="fixed"><el-table-column prop="name" label="名称" min-width="180" /><el-table-column v-if="isCategory" label="图标" width="150"><template #default="{ row }">{{ row.icon || '--' }}</template></el-table-column><el-table-column v-if="isCategory" prop="sort" label="排序" width="100" /><el-table-column v-else prop="heatScore" label="热度" width="100" /><el-table-column label="状态" width="120"><template #default="{ row }"><el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'" effect="plain">{{ row.status === 'ENABLED' ? '已启用' : '已停用' }}</el-tag></template></el-table-column><el-table-column label="更新时间" width="160"><template #default="{ row }">{{ formatTime(row.updatedAt) }}</template></el-table-column><el-table-column label="操作" width="240" fixed="right"><template #default="{ row }"><el-button link type="primary" :icon="EditPen" @click="openEdit(row)">编辑</el-button><el-switch :model-value="row.status === 'ENABLED'" :loading="rowLoading === row.id" inline-prompt active-text="启用" inactive-text="停用" @change="toggle(row)" /><el-button link type="danger" :loading="rowLoading === row.id" @click="remove(row)">删除</el-button></template></el-table-column></el-table>
        <el-pagination v-if="total" v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" @current-change="load" />
      </section>
    </section>
    <el-dialog v-model="editorOpen" :title="editing ? `编辑${isCategory ? '分类' : '标签'}` : `新建${isCategory ? '分类' : '标签'}`" width="480px" :close-on-click-modal="false"><el-form label-position="top"><el-form-item label="名称" required><el-input v-model="form.name" maxlength="64" show-word-limit /></el-form-item><template v-if="isCategory"><el-form-item label="图标标识"><el-input v-model="form.icon" maxlength="128" placeholder="可选，例如 building" /></el-form-item><el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" :precision="0" /></el-form-item></template><el-form-item v-else label="热度"><el-input-number v-model="form.heatScore" :min="0" /></el-form-item><el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio value="ENABLED">启用</el-radio><el-radio value="DISABLED">停用</el-radio></el-radio-group></el-form-item></el-form><template #footer><el-button @click="editorOpen = false">取消</el-button><el-button type="primary" :loading="submitting" @click="save">保存</el-button></template></el-dialog>
  </AdminShell>
</template>

<style scoped>
.management-page { display: grid; gap: 16px; }.page-header { display: flex; align-items: end; justify-content: space-between; }.page-header h2 { margin: 0; color: var(--yl-text); font-size: 20px; }.page-header p { margin: 6px 0 0; color: var(--yl-text-muted); font-size: 12px; }.filters { display: flex; gap: 10px; padding: 14px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.filters .el-input { width: 260px; }.filters .el-select { width: 130px; }.table-shell { overflow: hidden; min-height: 260px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.el-pagination { justify-content: flex-end; padding: 14px 18px; }.error-state { display: grid; justify-items: center; gap: 10px; padding: 64px; color: var(--yl-text-secondary); background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.error-state p { margin: 0; }.error-state small { color: var(--yl-text-muted); }.inline-error { display: flex; align-items: center; gap: 8px; padding: 9px 14px; color: #9f3b42; background: #fff6f6; font-size: 12px; }.inline-error button { margin-left: auto; color: inherit; background: transparent; border: 0; text-decoration: underline; cursor: pointer; }
</style>
