<script setup lang="ts">
import { Plus, RefreshRight } from '@element-plus/icons-vue';
import { computed, inject, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { AdminRepository, AdminRole, AdminStatus, AdminUser } from '../features/admin/model';
import { adminRepositoryKey, AdminRepositoryError } from '../features/admin/repository';

const repository = inject<AdminRepository>(adminRepositoryKey);
if (!repository) throw new Error('Admin repository is not configured');
const adminRepository = repository;

const admins = ref<AdminUser[]>([]);
const roles = ref<AdminRole[]>([]);
const total = ref(0);
const loading = ref(true);
const refreshing = ref(false);
const error = ref('');
const query = reactive({ page: 1, pageSize: 20, keyword: '', status: undefined as AdminStatus | undefined });
const dialog = ref<'create' | 'password' | ''>('');
const selected = ref<AdminUser>();
const submitting = ref(false);
const form = reactive({ username: '', password: '', roleCodes: [] as string[], newPassword: '' });
const statusOptions: AdminStatus[] = ['NORMAL', 'DISABLED'];
const dialogTitle = computed(() => dialog.value === 'create' ? '新建管理员' : '重置密码');
let requestId = 0;

function formatTime(value: string | null) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).format(new Date(value));
}

async function load() {
  const current = ++requestId;
  loading.value = !admins.value.length;
  refreshing.value = Boolean(admins.value.length);
  error.value = '';
  try {
    const result = await adminRepository.list(query);
    if (current !== requestId) return;
    admins.value = result.items;
    total.value = result.total;
  } catch (caught) {
    if (current === requestId) error.value = caught instanceof AdminRepositoryError ? caught.message : '管理员列表加载失败，请稍后重试。';
  } finally {
    if (current === requestId) { loading.value = false; refreshing.value = false; }
  }
}

async function loadRoles() {
  try { roles.value = await adminRepository.listRoles(); }
  catch (caught) { ElMessage.error(caught instanceof Error ? caught.message : '角色列表加载失败'); }
}

function search() { query.page = 1; void load(); }
function reset() { Object.assign(query, { page: 1, keyword: '', status: undefined }); void load(); }
function openCreate() { Object.assign(form, { username: '', password: '', roleCodes: [], newPassword: '' }); selected.value = undefined; dialog.value = 'create'; void loadRoles(); }
function openPassword(admin: AdminUser) { selected.value = admin; form.newPassword = ''; dialog.value = 'password'; }

async function save() {
  if (dialog.value === 'create' && (!form.username.trim() || form.password.length < 8 || !form.roleCodes.length)) {
    ElMessage.error('请填写用户名、至少 8 位密码并选择角色'); return;
  }
  if (dialog.value === 'password' && form.newPassword.length < 8) { ElMessage.error('新密码至少 8 位'); return; }
  submitting.value = true;
  const wasCreate = dialog.value === 'create';
  try {
    if (dialog.value === 'create') await adminRepository.create({ username: form.username.trim(), password: form.password, roleCodes: form.roleCodes });
    else if (dialog.value === 'password' && selected.value) await adminRepository.resetPassword(selected.value.id, form.newPassword);
    dialog.value = '';
    ElMessage.success('操作成功');
    if (wasCreate) { query.page = 1; }
    await load();
  } catch (caught) { ElMessage.error(caught instanceof Error ? caught.message : '操作失败'); }
  finally { submitting.value = false; }
}

async function toggleStatus(admin: AdminUser) {
  const next: AdminStatus = admin.status === 'NORMAL' ? 'DISABLED' : 'NORMAL';
  try {
    await ElMessageBox.confirm(`${next === 'DISABLED' ? '停用' : '启用'}管理员「${admin.username}」？`, '状态确认', { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' });
    await adminRepository.updateStatus(admin.id, next);
    await load();
    ElMessage.success('状态已更新');
  } catch (caught) { if (caught !== 'cancel' && caught !== 'close') ElMessage.error(caught instanceof Error ? caught.message : '状态更新失败'); }
}

onMounted(() => { void load(); });
</script>

<template>
  <section class="admin-page">
    <header class="page-header"><div><h2>后台管理员</h2><p>管理后台登录账号、角色与账号状态</p></div><div class="header-actions"><el-button :icon="RefreshRight" :loading="refreshing" @click="load">刷新</el-button><el-button type="primary" :icon="Plus" @click="openCreate">新建管理员</el-button></div></header>
    <div class="filters"><el-input v-model="query.keyword" clearable placeholder="搜索用户名" @keyup.enter="search" /><el-select v-model="query.status" clearable placeholder="全部状态" @change="search"><el-option v-for="status in statusOptions" :key="status" :label="status === 'NORMAL' ? '正常' : '已停用'" :value="status" /></el-select><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></div>
    <section class="table-shell" v-loading="loading || refreshing"><div v-if="error" class="inline-error">{{ error }} <button type="button" @click="load">重试</button></div><el-table :data="admins" empty-text="没有匹配的管理员" table-layout="fixed"><el-table-column prop="username" label="用户名" min-width="180" /><el-table-column label="角色" min-width="220"><template #default="{ row }"><el-tag v-for="code in row.roleCodes" :key="code" size="small" effect="plain">{{ roles.find(item => item.code === code)?.name ?? code }}</el-tag></template></el-table-column><el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="row.status === 'NORMAL' ? 'success' : 'info'" effect="plain">{{ row.status === 'NORMAL' ? '正常' : '已停用' }}</el-tag></template></el-table-column><el-table-column label="最近登录" width="150"><template #default="{ row }">{{ formatTime(row.lastLoginAt) }}</template></el-table-column><el-table-column label="创建时间" width="150"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column><el-table-column label="操作" width="180" fixed="right"><template #default="{ row }"><el-button type="warning" @click="openPassword(row)">重置密码</el-button><el-button link :type="row.status === 'NORMAL' ? 'danger' : 'success'" @click="toggleStatus(row)">{{ row.status === 'NORMAL' ? '停用' : '启用' }}</el-button></template></el-table-column></el-table><el-pagination v-if="total" v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" @current-change="load" /></section>
    <el-dialog v-model="dialog" :title="dialogTitle" width="460px" :close-on-click-modal="false"><el-form label-position="top"><template v-if="dialog === 'create'"><el-form-item label="用户名" required><el-input v-model="form.username" maxlength="64" /></el-form-item><el-form-item label="初始密码" required><el-input v-model="form.password" type="password" show-password maxlength="128" /></el-form-item></template><el-form-item v-if="dialog === 'create'" label="角色" required><el-checkbox-group v-model="form.roleCodes"><el-checkbox v-for="role in roles" :key="role.code" :value="role.code">{{ role.name }}</el-checkbox></el-checkbox-group></el-form-item><el-form-item v-if="dialog === 'password'" label="新密码" required><el-input v-model="form.newPassword" type="password" show-password maxlength="128" /></el-form-item></el-form><template #footer><el-button @click="dialog = ''">取消</el-button><el-button type="primary" :loading="submitting" @click="save">保存</el-button></template></el-dialog>
  </section>
</template>

<style scoped>
.admin-page { display: grid; gap: 16px; }.page-header { display: flex; align-items: end; justify-content: space-between; }.page-header h2 { margin: 0; color: var(--yl-text); font-size: 20px; }.page-header p { margin: 6px 0 0; color: var(--yl-text-muted); font-size: 12px; }.header-actions { display: flex; gap: 8px; }.filters { display: flex; gap: 10px; padding: 14px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.filters .el-input { width: 260px; }.filters .el-select { width: 130px; }.table-shell { overflow: hidden; min-height: 300px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.el-tag + .el-tag { margin-left: 5px; }.el-pagination { justify-content: flex-end; padding: 14px 18px; }.inline-error { padding: 9px 14px; color: #9f3b42; background: #fff6f6; font-size: 12px; }.inline-error button { float: right; color: inherit; background: transparent; border: 0; text-decoration: underline; cursor: pointer; }
</style>
