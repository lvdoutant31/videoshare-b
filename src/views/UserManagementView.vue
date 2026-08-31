<script setup lang="ts">
import { RefreshRight, UserFilled, WarningFilled } from '@element-plus/icons-vue';
import { computed, inject, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import AdminShell from '../layouts/AdminShell.vue';
import type { ManagedUser, ManagedUserDetail, TemporaryPenaltyInput, UserPenaltyType, UserQuery, UserRepository, UserStatus } from '../features/user/model';
import { userPenaltyLabel, userStatusLabel } from '../features/user/model';
import { UserRepositoryError, userRepositoryKey } from '../features/user/repository';
import { authState } from '../features/auth/repository';

const injectedRepository = inject<UserRepository>(userRepositoryKey);
if (!injectedRepository) throw new Error('User repository is not configured');
const repository: UserRepository = injectedRepository;
const router = useRouter();

const users = ref<ManagedUser[]>([]);
const total = ref(0);
const loading = ref(true);
const refreshing = ref(false);
const error = ref<{ message: string; traceId?: string }>();
const query = reactive<UserQuery>({ page: 1, pageSize: 20, keyword: '', status: undefined });
const selected = ref<ManagedUserDetail>();
const drawerOpen = ref(false);
const actionLoading = ref('');
const actionOpen = ref(false);
const actionType = ref<'MUTE' | 'SUSPEND' | 'BAN' | 'REVOKE' | 'UNBIND'>('MUTE');
const actionPenaltyId = ref<string>();
const actionForm = reactive({ reason: '', endsAt: '' });
const statuses: UserStatus[] = ['NORMAL', 'MUTED', 'SUSPENDED', 'BANNED', 'CANCELLED'];
let requestId = 0;

const actionTitle = computed(() => ({ MUTE: '禁言用户', SUSPEND: '临时封禁', BAN: '永久封禁', REVOKE: '提前解除处罚', UNBIND: '解绑企微身份' })[actionType.value]);
const needsDeadline = computed(() => actionType.value === 'MUTE' || actionType.value === 'SUSPEND');
const canModerate = computed(() => selected.value?.status !== 'CANCELLED');

function formatTime(value: string | null) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).format(new Date(value));
}

function statusType(status: UserStatus) {
  return status === 'NORMAL' ? 'success' : status === 'MUTED' ? 'warning' : status === 'SUSPENDED' || status === 'BANNED' ? 'danger' : 'info';
}

function penaltyType(type: UserPenaltyType) {
  return type === 'MUTE' ? 'warning' : 'danger';
}

async function load() {
  const currentRequest = ++requestId;
  const initial = !users.value.length;
  loading.value = initial;
  refreshing.value = !initial;
  error.value = undefined;
  try {
    const result = await repository.list(query);
    if (currentRequest !== requestId) return;
    users.value = result.items;
    total.value = result.total;
  } catch (caught) {
    if (currentRequest !== requestId) return;
    const typed = caught instanceof UserRepositoryError ? caught : undefined;
    if (typed?.code === 'UNAUTHORIZED') {
      authState.session = null;
      await router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
      return;
    }
    error.value = { message: typed?.message ?? '用户列表加载失败，请稍后重试。', traceId: typed?.traceId };
  } finally {
    if (currentRequest === requestId) {
      loading.value = false;
      refreshing.value = false;
    }
  }
}

function search() { query.page = 1; void load(); }
function reset() { Object.assign(query, { page: 1, keyword: '', status: undefined }); void load(); }

async function openDetail(user: ManagedUser) {
  drawerOpen.value = true;
  selected.value = undefined;
  try {
    selected.value = await repository.get(user.id);
  } catch (caught) {
    const typed = caught instanceof UserRepositoryError ? caught : undefined;
    if (typed?.code === 'UNAUTHORIZED') {
      authState.session = null;
      await router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
      return;
    }
    ElMessage.error(caught instanceof Error ? caught.message : '用户详情加载失败');
  }
}

async function refreshSelected() {
  if (selected.value) selected.value = await repository.get(selected.value.id);
}

function openAction(type: typeof actionType.value, penaltyId?: string) {
  actionType.value = type;
  actionPenaltyId.value = penaltyId;
  actionForm.reason = '';
  actionForm.endsAt = '';
  actionOpen.value = true;
}

function validDeadline() {
  return Boolean(actionForm.endsAt) && new Date(actionForm.endsAt).getTime() > Date.now();
}

async function submitAction() {
  if (!selected.value || !actionForm.reason.trim()) return;
  if (needsDeadline.value && !validDeadline()) {
    ElMessage.error('截止时间必须晚于当前时间');
    return;
  }

  const user = selected.value;
  const reason = actionForm.reason.trim();
  actionLoading.value = `${actionType.value}-${user.id}`;
  try {
    let updated: ManagedUserDetail;
    if (actionType.value === 'MUTE' || actionType.value === 'SUSPEND') {
      const input: TemporaryPenaltyInput = { reason, endsAt: actionForm.endsAt };
      updated = actionType.value === 'MUTE' ? await repository.mute(user.id, input) : await repository.suspend(user.id, input);
    } else if (actionType.value === 'REVOKE') {
      if (!actionPenaltyId.value) return;
      updated = await repository.revokePenalty(user.id, actionPenaltyId.value, { reason });
    } else if (actionType.value === 'UNBIND') {
      updated = await repository.unbindWeCom(user.id, { reason });
    } else {
      await ElMessageBox.confirm('确认永久封禁该用户？封禁后需要单独处理才能恢复。', '确认永久封禁', { type: 'error', confirmButtonText: '确认封禁', cancelButtonText: '取消' });
      const confirmationToken = await repository.requestBanConfirmation(user.id);
      updated = await repository.ban(user.id, { reason, confirmationToken });
    }
    selected.value = updated;
    actionOpen.value = false;
    await load();
    ElMessage.success(actionType.value === 'REVOKE' ? '处罚已解除' : actionType.value === 'UNBIND' ? '企微身份已解绑' : '用户状态已更新');
  } catch (caught) {
    if (caught === 'cancel' || caught === 'close') return;
    await handleActionError(caught);
  } finally {
    actionLoading.value = '';
  }
}

async function handleActionError(caught: unknown) {
  const typed = caught instanceof UserRepositoryError ? caught : undefined;
  if (typed?.code === 'UNAUTHORIZED') {
    authState.session = null;
    await router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
    return;
  } else if (typed?.code === 'USER_NOT_FOUND') {
    drawerOpen.value = false;
    await load();
  } else if (typed?.code === 'STATE_CONFLICT' || typed?.code === 'PENALTY_NOT_ACTIVE' || typed?.code === 'CONFIRMATION_INVALID') {
    await load();
    await refreshSelected();
  }
  ElMessage.error(typed?.message ?? '用户操作失败');
}

onMounted(() => { void load(); });
</script>

<template>
  <AdminShell page-title="用户管理" page-subtitle="查询用户资料并执行账号治理操作">
    <section class="user-page">
      <header class="page-header"><div><h2>用户管理</h2><p>查看用户状态、违规记录与企微绑定摘要</p></div><el-button :icon="RefreshRight" :loading="refreshing" @click="load">刷新</el-button></header>
      <div class="filters"><el-input v-model="query.keyword" clearable placeholder="用户 ID、昵称或手机号" @keyup.enter="search" /><el-select v-model="query.status" clearable placeholder="全部状态"><el-option v-for="status in statuses" :key="status" :label="userStatusLabel[status]" :value="status" /></el-select><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></div>
      <section v-if="error && !users.length" class="error-state"><el-icon><WarningFilled /></el-icon><p>{{ error.message }}</p><small v-if="error.traceId">诊断编号：{{ error.traceId }}</small><el-button @click="load">重试</el-button></section>
      <section v-else class="table-shell" v-loading="loading || refreshing"><div v-if="error" class="inline-error">{{ error.message }} <small v-if="error.traceId">诊断编号：{{ error.traceId }}</small><button type="button" @click="load">重试</button></div><el-table :data="users" empty-text="没有匹配的用户" table-layout="fixed"><el-table-column label="用户" min-width="190"><template #default="{ row }"><div class="user-name"><el-avatar :size="28" :src="row.avatarUrl"><el-icon><UserFilled /></el-icon></el-avatar><div><button type="button" class="name-link" @click="openDetail(row)">{{ row.nickname }}</button><small>ID {{ row.id }}</small></div></div></template></el-table-column><el-table-column prop="maskedPhone" label="手机号" width="130"><template #default="{ row }">{{ row.maskedPhone || '--' }}</template></el-table-column><el-table-column label="关注/粉丝" width="130"><template #default="{ row }">{{ row.followingCount }} / {{ row.followerCount }}</template></el-table-column><el-table-column prop="violationCount" label="违规次数" width="105" /><el-table-column label="最近登录" width="150"><template #default="{ row }">{{ formatTime(row.lastLoginAt) }}</template></el-table-column><el-table-column label="状态" width="145"><template #default="{ row }"><el-tag :type="statusType(row.status)" effect="plain">{{ userStatusLabel[row.status as UserStatus] }}</el-tag><small v-if="row.muteUntil">至 {{ formatTime(row.muteUntil) }}</small><small v-else-if="row.suspendUntil">至 {{ formatTime(row.suspendUntil) }}</small></template></el-table-column><el-table-column label="操作" width="100" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openDetail(row)">查看</el-button></template></el-table-column></el-table><el-pagination v-if="total" v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" @current-change="load" /></section>
    </section>
    <el-drawer v-model="drawerOpen" title="用户详情" size="560px"><div v-if="selected" class="detail"><div class="profile"><el-avatar :size="52" :src="selected.avatarUrl"><el-icon><UserFilled /></el-icon></el-avatar><div><h3>{{ selected.nickname }}</h3><p>ID {{ selected.id }} · {{ selected.maskedPhone || '已匿名化' }}</p></div><el-tag :type="statusType(selected.status)">{{ userStatusLabel[selected.status] }}</el-tag></div><div class="summary-grid"><div><span>注册时间</span><b>{{ formatTime(selected.createdAt) }}</b></div><div><span>最近登录</span><b>{{ formatTime(selected.lastLoginAt) }}</b></div><div><span>关注 / 粉丝</span><b>{{ selected.followingCount }} / {{ selected.followerCount }}</b></div><div><span>违规次数</span><b>{{ selected.violationCount }}</b></div></div><section><h4>企微绑定</h4><div class="info-row"><span>{{ selected.weComBinding.bound ? `已绑定${selected.weComBinding.organizationName ?? ''}` : '未绑定企微身份' }}</span><el-button v-if="canModerate && selected.weComBinding.bound" link type="danger" @click="openAction('UNBIND')">解绑</el-button></div></section><section><h4>设备摘要</h4><div class="summary-grid compact"><div><span>近期设备</span><b>{{ selected.devices.recentDeviceCount }} 台</b></div><div><span>最后活跃</span><b>{{ formatTime(selected.devices.lastActiveAt) }}</b></div></div></section><section><h4>处罚记录</h4><ol v-if="selected.penalties.length" class="history"><li v-for="penalty in selected.penalties" :key="penalty.id"><div><el-tag :type="penaltyType(penalty.type)" size="small">{{ userPenaltyLabel[penalty.type] }}</el-tag><b>{{ penalty.reason }}</b></div><time>{{ formatTime(penalty.startsAt) }}{{ penalty.endsAt ? ` 至 ${formatTime(penalty.endsAt)}` : '' }}</time><p v-if="penalty.revokedAt">已于 {{ formatTime(penalty.revokedAt) }} 提前解除：{{ penalty.revokedReason }}</p><el-button v-else-if="canModerate && penalty.active" link type="primary" @click="openAction('REVOKE', penalty.id)">提前解除</el-button></li></ol><p v-else class="muted">暂无处罚记录。</p></section><footer v-if="canModerate" class="drawer-actions"><el-button v-if="selected.status === 'NORMAL'" type="warning" @click="openAction('MUTE')">禁言</el-button><el-button v-if="selected.status !== 'SUSPENDED' && selected.status !== 'BANNED'" type="danger" plain @click="openAction('SUSPEND')">临时封禁</el-button><el-button v-if="selected.status !== 'BANNED'" type="danger" @click="openAction('BAN')">永久封禁</el-button></footer><p v-else class="read-only">已注销用户仅可查看历史信息。</p></div><el-skeleton v-else :rows="10" animated /></el-drawer>
    <el-dialog v-model="actionOpen" :title="actionTitle" width="460px" :close-on-click-modal="false"><p class="action-description">{{ actionType === 'BAN' ? '永久封禁属于高风险操作，确认后将立即限制该账号。' : actionType === 'REVOKE' ? '请记录提前解除处罚的依据。' : actionType === 'UNBIND' ? '解绑后用户将无法使用该企微身份登录。' : '请填写处理依据，用户将看到相应的账号状态变化。' }}</p><el-form label-position="top"><el-form-item label="处理原因" required><el-input v-model="actionForm.reason" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item><el-form-item v-if="needsDeadline" label="截止时间" required><el-date-picker v-model="actionForm.endsAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="选择截止时间" /></el-form-item></el-form><template #footer><el-button @click="actionOpen = false">取消</el-button><el-button :type="actionType === 'MUTE' ? 'warning' : 'danger'" :disabled="!actionForm.reason.trim() || (needsDeadline && !actionForm.endsAt)" :loading="Boolean(actionLoading)" @click="submitAction">确认{{ actionTitle }}</el-button></template></el-dialog>
  </AdminShell>
</template>

<style scoped>
.user-page { display: grid; gap: 16px; }.page-header { display: flex; align-items: end; justify-content: space-between; }.page-header h2, .profile h3, .detail h4 { margin: 0; color: var(--yl-text); }.page-header h2 { font-size: 20px; }.page-header p, .profile p, .muted, .read-only { margin: 6px 0 0; color: var(--yl-text-muted); font-size: 12px; }.filters { display: flex; gap: 10px; padding: 14px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.filters .el-input { width: 260px; }.filters .el-select { width: 130px; }.table-shell { overflow: hidden; min-height: 300px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.el-pagination { justify-content: flex-end; padding: 14px 18px; }.el-table small { display: block; margin-top: 3px; color: var(--yl-text-muted); font-size: 10px; }.user-name, .profile { display: flex; align-items: center; gap: 10px; }.name-link { display: block; padding: 0; color: var(--yl-text); background: transparent; border: 0; font-weight: 600; cursor: pointer; }.name-link:hover { color: var(--yl-indigo); }.error-state { display: grid; justify-items: center; gap: 10px; padding: 70px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.error-state .el-icon { color: var(--yl-coral); font-size: 28px; }.error-state p { margin: 0; }.error-state small { color: var(--yl-text-muted); }.inline-error { display: flex; align-items: center; gap: 8px; padding: 9px 14px; color: #9f3b42; background: #fff6f6; font-size: 12px; }.inline-error button { margin-left: auto; color: inherit; background: transparent; border: 0; text-decoration: underline; cursor: pointer; }.detail { display: grid; gap: 20px; }.profile { align-items: flex-start; }.profile .el-tag { margin-left: auto; }.summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; overflow: hidden; background: var(--yl-border); border: 1px solid var(--yl-border); border-radius: 6px; }.summary-grid div { display: grid; gap: 5px; padding: 10px; background: var(--yl-surface); }.summary-grid span { color: var(--yl-text-muted); font-size: 11px; }.summary-grid b { color: var(--yl-text-secondary); font-size: 12px; }.summary-grid.compact { background: transparent; border: 0; gap: 10px; }.summary-grid.compact div { background: var(--yl-surface-subtle); border-radius: 5px; }.detail section { display: grid; gap: 10px; }.info-row { display: flex; align-items: center; justify-content: space-between; padding: 10px; color: var(--yl-text-secondary); background: var(--yl-surface-subtle); border-radius: 5px; font-size: 12px; }.history { display: grid; gap: 10px; margin: 0; padding: 0 0 0 14px; border-left: 2px solid var(--yl-border); list-style: none; }.history li { position: relative; display: grid; gap: 5px; }.history li::before { position: absolute; top: 4px; left: -19px; width: 8px; height: 8px; content: ''; background: var(--yl-indigo); border-radius: 50%; }.history li > div { display: flex; align-items: center; gap: 8px; font-size: 12px; }.history time, .history p { margin: 0; color: var(--yl-text-muted); font-size: 11px; }.history .el-button { justify-self: start; padding: 0; }.drawer-actions { display: flex; flex-wrap: wrap; gap: 10px; padding-top: 4px; }.read-only { padding: 10px; background: var(--yl-surface-subtle); border-radius: 5px; }.action-description { margin: 0 0 16px; color: var(--yl-text-secondary); font-size: 12px; }
</style>
