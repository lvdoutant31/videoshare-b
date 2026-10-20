<script setup lang="ts">
import { Plus, RefreshRight } from '@element-plus/icons-vue';
import { computed, inject, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { AdminPermission, AdminRepository, AdminStatus, AdminUser } from '../features/admin/model';
import { adminRepositoryKey, AdminRepositoryError } from '../features/admin/repository';
import { hasPermission } from '../features/auth/permissions';
import { authState, createAdminAuthRepository, type AdminAppAccount } from '../features/auth/repository';

const repository = inject<AdminRepository>(adminRepositoryKey);
if (!repository) throw new Error('Admin repository is not configured');
const adminRepository = repository;
const authRepository = createAdminAuthRepository(
  import.meta.env.VITE_API_BASE_URL ?? '/videoshare',
  globalThis.fetch.bind(globalThis),
  import.meta.env.VITE_API_ENCRYPTION_ENABLED !== 'false',
);

const admins = ref<AdminUser[]>([]);
const total = ref(0);
const loading = ref(true);
const refreshing = ref(false);
const error = ref('');
const query = reactive({ page: 1, pageSize: 20, keyword: '', status: undefined as AdminStatus | undefined });
const dialogOpen = ref(false);
const dialogMode = ref<'create' | 'password'>('create');
const selected = ref<AdminUser>();
const submitting = ref(false);
const form = reactive({ username: '', password: '', newPassword: '' });
const permissionsOpen = ref(false);
const permissionSaving = ref(false);
const permissionLoading = ref(false);
const permissionTarget = ref<AdminUser>();
const permissionCatalog = ref<AdminPermission[]>([]);
const selectedPermissions = ref<string[]>([]);
const appAccounts = ref<Record<string, AdminAppAccount>>({});
const bindingTarget = ref<AdminUser>();
const bindingLoading = ref(false);
const bindingLoadFailed = ref(false);
const bindingOpen = ref(false);
const bindingSaving = ref(false);
const bindingForm = reactive({ phone: '', password: '' });
const statusOptions: AdminStatus[] = ['NORMAL', 'DISABLED'];
let requestId = 0;
const canCreate = computed(() => hasPermission('admin:create'));
const canResetPassword = computed(() => hasPermission('admin:password'));
const canChangeStatus = computed(() => hasPermission('admin:status'));
const canAssignPermissions = computed(() => hasPermission('admin:permissions'));
const canBindAppAccount = computed(() => Boolean(authState.session));
const isSuperAdmin = computed(() => authState.session?.roles?.includes('SUPER_ADMIN') ?? false);
const bindingAccount = computed(() => bindingTarget.value ? appAccounts.value[bindingTarget.value.id] : undefined);
const menuNames: Record<string, string> = {
  dashboard: '工作台', video: '内容管理', review: '审核管理', user: '用户管理',
  admin: '管理员管理', comment: '评论与举报', category: '分类管理', tag: '标签管理',
  'operation-log': '操作日志', 'runtime-log': '运行日志'
};
const menuPermissions = computed(() => permissionCatalog.value.map(permission => ({
  ...permission,
  label: menuNames[permission.code.split(':', 1)[0]] ?? permission.name
})));

function formatTime(value: string | null) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).format(new Date(value));
}

function isCurrentAdmin(admin: AdminUser) {
  return admin.id === authState.session?.id;
}

function canBindAdmin(admin: AdminUser) {
  return admin.status === 'NORMAL' && (isCurrentAdmin(admin) || isSuperAdmin.value);
}

async function loadAppAccount(admin: AdminUser) {
  bindingLoading.value = true;
  bindingLoadFailed.value = false;
  try {
    const account = isCurrentAdmin(admin)
      ? await authRepository.appAccount()
      : await adminRepository.getAppAccount(admin.id);
    if (bindingTarget.value?.id === admin.id) appAccounts.value[admin.id] = account;
  } catch (caught) {
    if (bindingTarget.value?.id !== admin.id) return;
    bindingLoadFailed.value = true;
    ElMessage.error(caught instanceof Error ? caught.message : '手机号绑定状态加载失败');
  } finally {
    if (bindingTarget.value?.id === admin.id) bindingLoading.value = false;
  }
}

function openBinding(admin: AdminUser) {
  if (!canBindAdmin(admin)) return;
  bindingTarget.value = admin;
  Object.assign(bindingForm, { phone: '', password: '' });
  bindingOpen.value = true;
  void loadAppAccount(admin);
}

async function bindAppAccount() {
  const target = bindingTarget.value;
  if (!target || !canBindAdmin(target) || bindingLoading.value || bindingLoadFailed.value
      || bindingSaving.value || bindingAccount.value?.bound) return;
  if (!/^1\d{10}$/.test(bindingForm.phone) || bindingForm.password.length < 8) {
    ElMessage.error('请填写有效手机号及至少 8 位登录密码');
    return;
  }
  bindingSaving.value = true;
  try {
    appAccounts.value[target.id] = isCurrentAdmin(target)
      ? await authRepository.bindAppAccount(bindingForm.phone, bindingForm.password)
      : await adminRepository.bindAppAccount(target.id, bindingForm.phone, bindingForm.password);
    bindingOpen.value = false;
    ElMessage.success('手机号已绑定');
  } catch (caught) {
    ElMessage.error(caught instanceof Error ? caught.message : '手机号绑定失败');
  } finally { bindingSaving.value = false; }
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

function search() { query.page = 1; void load(); }
function reset() { Object.assign(query, { page: 1, keyword: '', status: undefined }); void load(); }
function openCreate() { if (!canCreate.value) return; Object.assign(form, { username: '', password: '', newPassword: '' }); selected.value = undefined; dialogMode.value = 'create'; dialogOpen.value = true; }
function openPassword(admin: AdminUser) { if (!canResetPassword.value) return; selected.value = admin; form.newPassword = ''; dialogMode.value = 'password'; dialogOpen.value = true; }

async function openPermissions(admin: AdminUser) {
  if (!canAssignPermissions.value || admin.roleCodes.includes('SUPER_ADMIN')) return;
  permissionTarget.value = admin;
  permissionsOpen.value = true;
  permissionLoading.value = true;
  try {
    const [catalog, current] = await Promise.all([
      adminRepository.listPermissions(), adminRepository.getPermissions(admin.id)
    ]);
    permissionCatalog.value = catalog;
    selectedPermissions.value = current;
  } catch (caught) {
    permissionsOpen.value = false;
    ElMessage.error(caught instanceof Error ? caught.message : '权限加载失败');
  } finally { permissionLoading.value = false; }
}

async function savePermissions() {
  const target = permissionTarget.value;
  if (!target || !canAssignPermissions.value) return;
  permissionSaving.value = true;
  try {
    await adminRepository.updatePermissions(target.id, selectedPermissions.value);
    permissionsOpen.value = false;
    ElMessage.success('管理员权限已更新');
  } catch (caught) { ElMessage.error(caught instanceof Error ? caught.message : '权限保存失败'); }
  finally { permissionSaving.value = false; }
}

async function save() {
  if (dialogMode.value === 'create' && (!form.username.trim() || form.password.length < 6)) {
    ElMessage.error('请填写用户名和至少 6 位密码'); return;
  }
  if (dialogMode.value === 'password' && form.newPassword.length < 6) {
    ElMessage.error('新密码至少 6 位'); return;
  }
  submitting.value = true;
  const mode = dialogMode.value;
  try {
    if (mode === 'create') {
      await adminRepository.create({ username: form.username.trim(), password: form.password });
    } else if (mode === 'password' && selected.value) {
      await adminRepository.resetPassword(selected.value.id, form.newPassword);
    }
    dialogOpen.value = false;
    ElMessage.success('操作成功');
    if (mode === 'create') await load();
  } catch (caught) { ElMessage.error(caught instanceof Error ? caught.message : '操作失败'); }
  finally { submitting.value = false; }
}

async function toggleStatus(admin: AdminUser) {
  if (!canChangeStatus.value) return;
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
    <header class="page-header"><div><h2>后台管理员</h2><p>管理后台登录账号与账号状态</p></div><div class="header-actions"><el-button :icon="RefreshRight" :loading="refreshing" @click="load">刷新</el-button><el-button v-if="canCreate" type="primary" :icon="Plus" @click="openCreate">新建管理员</el-button></div></header>
    <div class="filters"><el-input v-model="query.keyword" clearable placeholder="搜索用户名" @keyup.enter="search" /><el-select v-model="query.status" clearable placeholder="全部状态" @change="search"><el-option v-for="status in statusOptions" :key="status" :label="status === 'NORMAL' ? '正常' : '已停用'" :value="status" /></el-select><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></div>
    <section class="table-shell" v-loading="loading || refreshing"><div v-if="error" class="inline-error">{{ error }} <button type="button" @click="load">重试</button></div><el-table :data="admins" empty-text="没有匹配的管理员" table-layout="fixed"><el-table-column prop="username" label="用户名" min-width="180" /><el-table-column label="账号类型" min-width="150"><template #default="{ row }">{{ row.roleCodes.includes('SUPER_ADMIN') ? '超级管理员' : '普通管理员' }}</template></el-table-column><el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="row.status === 'NORMAL' ? 'success' : 'info'" effect="plain">{{ row.status === 'NORMAL' ? '正常' : '已停用' }}</el-tag></template></el-table-column><el-table-column label="最近登录" width="150"><template #default="{ row }">{{ formatTime(row.lastLoginAt) }}</template></el-table-column><el-table-column label="创建时间" width="150"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column><el-table-column v-if="canAssignPermissions || canResetPassword || canChangeStatus || canBindAppAccount" label="操作" min-width="330" fixed="right"><template #default="{ row }"><template v-if="canBindAdmin(row)"><el-tag v-if="appAccounts[row.id]?.bound" size="small" effect="plain">{{ appAccounts[row.id].maskedPhone }}</el-tag><el-button v-else link type="primary" @click="openBinding(row)">绑定手机号</el-button></template><el-button v-if="canAssignPermissions && !row.roleCodes.includes('SUPER_ADMIN')" link type="primary" @click="openPermissions(row)">配置页面权限</el-button><el-button v-if="canResetPassword" link type="warning" @click="openPassword(row)">重置密码</el-button><el-button v-if="canChangeStatus" link :type="row.status === 'NORMAL' ? 'danger' : 'success'" @click="toggleStatus(row)">{{ row.status === 'NORMAL' ? '停用' : '启用' }}</el-button></template></el-table-column></el-table><el-pagination v-if="total" v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" @current-change="load" /></section>
    <el-dialog v-model="dialogOpen" :title="dialogMode === 'create' ? '新建管理员' : '重置密码'" width="460px" :close-on-click-modal="false"><el-form label-position="top"><template v-if="dialogMode === 'create'"><el-form-item label="用户名" required><el-input v-model="form.username" maxlength="64" /></el-form-item><el-form-item label="初始密码" required><el-input v-model="form.password" type="password" show-password maxlength="128" /></el-form-item></template><el-form-item v-else label="新密码" required><el-input v-model="form.newPassword" type="password" show-password maxlength="128" /></el-form-item></el-form><template #footer><el-button @click="dialogOpen = false">取消</el-button><el-button type="primary" :loading="submitting" @click="save">保存</el-button></template></el-dialog>
    <el-dialog v-model="permissionsOpen" :title="`分配菜单${permissionTarget ? `：${permissionTarget.username}` : ''}`" width="560px" :close-on-click-modal="false"><div v-loading="permissionLoading" class="permission-groups"><p class="permission-hint">勾选后，该管理员可在侧边栏看到并进入对应菜单。</p><el-checkbox-group v-model="selectedPermissions" class="menu-permissions"><el-checkbox v-for="menu in menuPermissions" :key="menu.code" :value="menu.code">{{ menu.label }}</el-checkbox></el-checkbox-group><el-empty v-if="!permissionLoading && !menuPermissions.length" description="暂无可分配菜单" /></div><template #footer><el-button @click="permissionsOpen = false">取消</el-button><el-button type="primary" :loading="permissionSaving" @click="savePermissions">保存菜单</el-button></template></el-dialog>
    <el-dialog v-model="bindingOpen" :title="`绑定手机号：${bindingTarget?.username ?? ''}`" width="420px" :close-on-click-modal="false" :close-on-press-escape="!bindingSaving" :show-close="!bindingSaving">
      <div v-loading="bindingLoading">
        <p v-if="bindingLoadFailed" class="permission-hint">绑定状态加载失败。<el-button link type="primary" @click="bindingTarget && loadAppAccount(bindingTarget)">重试</el-button></p>
        <p v-else-if="bindingAccount?.bound" class="permission-hint">已绑定手机号：{{ bindingAccount.maskedPhone }}</p>
        <template v-else-if="!bindingLoading">
          <p class="permission-hint">绑定后，该管理员可使用手机号和设置的密码登录，已发布内容继续关联原作者资料。</p>
          <el-form label-position="top">
            <el-form-item label="手机号"><el-input v-model="bindingForm.phone" inputmode="numeric" maxlength="11" autocomplete="tel" /></el-form-item>
            <el-form-item label="登录密码"><el-input v-model="bindingForm.password" type="password" show-password maxlength="64" autocomplete="new-password" /></el-form-item>
          </el-form>
        </template>
      </div>
      <template #footer><el-button :disabled="bindingSaving" @click="bindingOpen = false">取消</el-button><el-button v-if="!bindingAccount?.bound" type="primary" :disabled="bindingLoading || bindingLoadFailed" :loading="bindingSaving" @click="bindAppAccount">确认绑定</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.admin-page { display: grid; gap: 16px; }.page-header { display: flex; align-items: end; justify-content: space-between; }.page-header h2 { margin: 0; color: var(--yl-text); font-size: 20px; }.page-header p { margin: 6px 0 0; color: var(--yl-text-muted); font-size: 12px; }.header-actions { display: flex; gap: 8px; }.filters { display: flex; gap: 10px; padding: 14px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.filters .el-input { width: 260px; }.filters .el-select { width: 130px; }.table-shell { overflow: hidden; min-height: 300px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.el-tag + .el-tag { margin-left: 5px; }.el-pagination { justify-content: flex-end; padding: 14px 18px; }.inline-error { padding: 9px 14px; color: #9f3b42; background: #fff6f6; font-size: 12px; }.inline-error button { float: right; color: inherit; background: transparent; border: 0; text-decoration: underline; cursor: pointer; }.permission-hint { margin: 0 0 16px; color: var(--yl-text-muted); font-size: 12px; }.menu-permissions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
</style>
