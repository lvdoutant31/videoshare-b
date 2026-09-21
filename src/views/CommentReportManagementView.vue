<script setup lang="ts">
import { ChatDotRound, DocumentChecked, RefreshRight, VideoPlay, WarningFilled } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, inject, onMounted, reactive, ref, watch } from 'vue';
import AdminShell from '../layouts/AdminShell.vue';
import { commentStatusLabel, reportStatusLabel, reportTargetLabel, riskLevelLabel, type CommentQuery, type CommentStatus, type ContentReport, type ContentReportDetail, type ManagedComment, type ManagedCommentDetail, type ModerationRiskLevel, type ReportQuery, type ReportStatus, type ReportTargetType } from '../features/comment-report/model';
import { CommentReportRepositoryError, commentReportRepositoryKey } from '../features/comment-report/repository';

const props = defineProps<{ resource: 'comments' | 'reports' }>();
const injectedRepository = inject(commentReportRepositoryKey) as import('../features/comment-report/model').CommentReportRepository | undefined;
if (!injectedRepository) throw new Error('Comment report repository is not configured');
const repository = injectedRepository;

const comments = ref<ManagedComment[]>([]);
const reports = ref<ContentReport[]>([]);
const total = ref(0);
const loading = ref(true);
const refreshing = ref(false);
const error = ref<{ message: string; traceId?: string }>();
let requestId = 0;
const commentQuery = reactive<CommentQuery>({ page: 1, pageSize: 20, keyword: '', status: undefined, riskLevel: undefined });
const reportQuery = reactive<ReportQuery>({ page: 1, pageSize: 20, targetType: undefined, status: undefined, riskLevel: undefined });
const selectedComment = ref<ManagedCommentDetail>();
const selectedReport = ref<ContentReportDetail>();
const drawerOpen = ref(false);
const selectedIds = ref<string[]>([]);
const actionOpen = ref(false);
const action = ref<'HIDE' | 'DELETE' | 'BATCH_HIDE' | 'BATCH_DELETE' | 'RESOLVE' | 'REJECT'>('HIDE');
const reason = ref('');
const actionLoading = ref('');

const isComments = computed(() => props.resource === 'comments');
const title = computed(() => isComments.value ? '评论管理' : '举报处置');
const subtitle = computed(() => isComments.value ? '管理评论状态、风险提示与处置记录' : '领取并处理用户提交的内容举报');
const commentStatuses: CommentStatus[] = ['PENDING', 'NORMAL', 'HIDDEN', 'DELETED'];
const reportStatuses: ReportStatus[] = ['PENDING', 'PROCESSING', 'RESOLVED', 'REJECTED'];
const risks: ModerationRiskLevel[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];
const targetTypes: ReportTargetType[] = ['VIDEO', 'COMMENT', 'USER'];
const actionTitle = computed(() => ({ HIDE: '隐藏评论', DELETE: '删除评论', BATCH_HIDE: '批量隐藏评论', BATCH_DELETE: '批量删除评论', RESOLVE: '解决举报', REJECT: '驳回举报' })[action.value]);
const activeDetail = computed(() => selectedComment.value ?? selectedReport.value);
const canDecideReport = computed(() => selectedReport.value?.status === 'PROCESSING' && selectedReport.value.assignee === '当前管理员');

function time(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).format(new Date(value)); }
function riskType(value: ModerationRiskLevel) { return value === 'HIGH' ? 'danger' : value === 'MEDIUM' ? 'warning' : value === 'LOW' ? 'success' : 'info'; }
function commentStatusType(value: CommentStatus) { return value === 'DELETED' ? 'danger' : value === 'HIDDEN' ? 'warning' : value === 'PENDING' ? 'info' : 'success'; }
function reportStatusType(value: ReportStatus) { return value === 'REJECTED' ? 'info' : value === 'RESOLVED' ? 'success' : value === 'PROCESSING' ? 'warning' : 'danger'; }

async function load() {
  const current = ++requestId;
  const initial = !(isComments.value ? comments.value.length : reports.value.length);
  loading.value = initial;
  refreshing.value = !initial;
  error.value = undefined;
  try {
    const page = isComments.value ? await repository.listComments(commentQuery) : await repository.listReports(reportQuery);
    if (current !== requestId) return;
    total.value = page.total;
    if (isComments.value) comments.value = page.items as ManagedComment[];
    else reports.value = page.items as ContentReport[];
  } catch (caught) {
    if (current === requestId) {
      const typed = caught instanceof CommentReportRepositoryError ? caught : undefined;
      error.value = { message: typed?.message ?? `${title.value}加载失败`, traceId: typed?.traceId };
    }
  } finally {
    if (current === requestId) { loading.value = false; refreshing.value = false; }
  }
}

function search() { if (isComments.value) commentQuery.page = 1; else reportQuery.page = 1; void load(); }
function reset() {
  Object.assign(commentQuery, { page: 1, keyword: '', status: undefined, riskLevel: undefined });
  Object.assign(reportQuery, { page: 1, targetType: undefined, status: undefined, riskLevel: undefined });
  void load();
}
async function openComment(row: ManagedComment) { drawerOpen.value = true; selectedReport.value = undefined; selectedComment.value = undefined; try { selectedComment.value = await repository.getComment(row.id); } catch (caught) { ElMessage.error(caught instanceof Error ? caught.message : '评论详情加载失败'); } }
async function openReport(row: ContentReport) { drawerOpen.value = true; selectedComment.value = undefined; selectedReport.value = undefined; try { selectedReport.value = await repository.getReport(row.id); } catch (caught) { ElMessage.error(caught instanceof Error ? caught.message : '举报详情加载失败'); } }
async function refreshDetail() { if (selectedComment.value) selectedComment.value = await repository.getComment(selectedComment.value.id); if (selectedReport.value) selectedReport.value = await repository.getReport(selectedReport.value.id); }
function openAction(next: typeof action.value) { action.value = next; reason.value = ''; actionOpen.value = true; }
async function restoreComment() {
  if (!selectedComment.value) return;
  actionLoading.value = `restore-${selectedComment.value.id}`;
  try { selectedComment.value = await repository.restoreComment(selectedComment.value.id); await load(); ElMessage.success('评论已恢复'); } catch (caught) { await handleActionError(caught); } finally { actionLoading.value = ''; }
}
async function submitAction() {
  if (!reason.value.trim()) return;
  const targetId = selectedComment.value?.id ?? selectedReport.value?.id;
  if (!targetId) return;
  actionLoading.value = `${action.value}-${targetId}`;
  try {
    if (action.value === 'HIDE') selectedComment.value = await repository.hideComment(targetId, reason.value.trim());
    if (action.value === 'DELETE') selectedComment.value = await repository.deleteComment(targetId, reason.value.trim());
    if (action.value === 'BATCH_HIDE' || action.value === 'BATCH_DELETE') {
      await repository.batchHandleComments(selectedIds.value, action.value === 'BATCH_HIDE' ? 'HIDDEN' : 'DELETED', reason.value.trim());
      selectedIds.value = [];
      ElMessage.success('批量处置已提交');
    }
    if (action.value === 'RESOLVE') selectedReport.value = await repository.resolveReport(targetId, reason.value.trim());
    if (action.value === 'REJECT') selectedReport.value = await repository.rejectReport(targetId, reason.value.trim());
    actionOpen.value = false;
    await load();
    ElMessage.success(action.value === 'REJECT' ? '举报已驳回' : action.value === 'RESOLVE' ? '举报已解决' : '处置已完成');
  } catch (caught) { await handleActionError(caught); } finally { actionLoading.value = ''; }
}
async function claimReport() {
  if (!selectedReport.value) return;
  actionLoading.value = `claim-${selectedReport.value.id}`;
  try { selectedReport.value = await repository.claimReport(selectedReport.value.id); await load(); ElMessage.success('已领取举报'); } catch (caught) { await handleActionError(caught); } finally { actionLoading.value = ''; }
}
async function handleActionError(caught: unknown) {
  const typed = caught instanceof CommentReportRepositoryError ? caught : undefined;
  if (typed?.code === 'STATE_CONFLICT' || typed?.code === 'REPORT_ALREADY_CLAIMED' || typed?.code === 'REPORT_NOT_CLAIMED_BY_CURRENT_OPERATOR') {
    ElMessage.error('状态已变化，已重新加载最新信息');
    await load();
    await refreshDetail();
    return;
  }
  if (typed?.code === 'COMMENT_NOT_FOUND' || typed?.code === 'REPORT_NOT_FOUND') { drawerOpen.value = false; await load(); }
  ElMessage.error(typed?.message ?? '处置失败');
}
async function confirmBatch(next: 'BATCH_HIDE' | 'BATCH_DELETE') {
  if (!selectedIds.value.length) return;
  try { await ElMessageBox.confirm(`确认${next === 'BATCH_HIDE' ? '隐藏' : '删除'}选中的 ${selectedIds.value.length} 条评论？`, '确认批量处置', { type: 'warning', confirmButtonText: '继续' }); openAction(next); } catch { /* user cancelled */ }
}
watch(() => props.resource, () => { comments.value = []; reports.value = []; total.value = 0; selectedIds.value = []; drawerOpen.value = false; reset(); });
onMounted(() => { void load(); });
</script>

<template>
  <AdminShell :page-title="title" :page-subtitle="subtitle">
    <section class="management-page">
      <header class="page-header"><div><h2>{{ title }}</h2><p>{{ subtitle }}</p></div><el-button :icon="RefreshRight" :loading="refreshing" @click="load">刷新</el-button></header>
      <div class="filters" v-if="isComments"><el-input v-model="commentQuery.keyword" placeholder="评论内容、作者、视频或 ID" clearable @keyup.enter="search" /><el-select v-model="commentQuery.status" placeholder="全部状态" clearable><el-option v-for="status in commentStatuses" :key="status" :value="status" :label="commentStatusLabel[status]" /></el-select><el-select v-model="commentQuery.riskLevel" placeholder="全部风险" clearable><el-option v-for="risk in risks" :key="risk" :value="risk" :label="riskLevelLabel[risk]" /></el-select><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></div>
      <div class="filters" v-else><el-select v-model="reportQuery.targetType" placeholder="全部对象" clearable><el-option v-for="type in targetTypes" :key="type" :value="type" :label="reportTargetLabel[type]" /></el-select><el-select v-model="reportQuery.status" placeholder="全部状态" clearable><el-option v-for="status in reportStatuses" :key="status" :value="status" :label="reportStatusLabel[status]" /></el-select><el-select v-model="reportQuery.riskLevel" placeholder="全部风险" clearable><el-option v-for="risk in risks" :key="risk" :value="risk" :label="riskLevelLabel[risk]" /></el-select><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></div>
      <section v-if="error && !(isComments ? comments.length : reports.length)" class="error-state"><el-icon><WarningFilled /></el-icon><p>{{ error.message }}</p><small v-if="error.traceId">诊断编号：{{ error.traceId }}</small><el-button @click="load">重试</el-button></section>
      <section v-else class="table-shell" v-loading="loading || refreshing"><div v-if="error" class="inline-error">{{ error.message }} <button type="button" @click="load">重试</button></div><div v-if="isComments && selectedIds.length" class="batch-bar"><span>已选择 {{ selectedIds.length }} 条评论</span><el-button size="small" @click="confirmBatch('BATCH_HIDE')">批量隐藏</el-button><el-button size="small" type="danger" @click="confirmBatch('BATCH_DELETE')">批量删除</el-button></div>
        <el-table v-if="isComments" :data="comments" @selection-change="selectedIds = $event.map((item: ManagedComment) => item.id)"><el-table-column type="selection" width="46" /><el-table-column label="评论内容" min-width="250"><template #default="{ row }"><button class="content-link" type="button" @click="openComment(row)">{{ row.content }}</button><small>{{ row.author }}</small></template></el-table-column><el-table-column label="所属视频" min-width="190"><template #default="{ row }"><span class="video-context"><el-icon><VideoPlay /></el-icon><b>{{ row.videoTitle || '未知视频' }}</b></span></template></el-table-column><el-table-column label="风险" width="110"><template #default="{ row }"><el-tag :type="riskType(row.riskLevel as ModerationRiskLevel)" effect="plain">{{ riskLevelLabel[row.riskLevel as ModerationRiskLevel] }}</el-tag></template></el-table-column><el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="commentStatusType(row.status as CommentStatus)" effect="plain">{{ commentStatusLabel[row.status as CommentStatus] }}</el-tag></template></el-table-column><el-table-column label="互动" width="100"><template #default="{ row }">{{ row.likeCount }} 赞 · {{ row.replyCount }} 回复</template></el-table-column><el-table-column label="发布时间" width="140"><template #default="{ row }">{{ time(row.createdAt) }}</template></el-table-column><el-table-column label="操作" width="90" fixed="right"><template #default="{ row }"><el-button link :icon="ChatDotRound" @click="openComment(row)">查看</el-button></template></el-table-column></el-table>
        <el-table v-else :data="reports"><el-table-column label="举报对象" min-width="230"><template #default="{ row }"><button class="content-link" type="button" @click="openReport(row)">{{ row.targetSummary }}</button><small>{{ reportTargetLabel[row.targetType as ReportTargetType] }} · {{ row.reporter }}</small></template></el-table-column><el-table-column label="举报原因" min-width="140" prop="reason" /><el-table-column label="风险" width="105"><template #default="{ row }"><el-tag :type="riskType(row.riskLevel as ModerationRiskLevel)" effect="plain">{{ riskLevelLabel[row.riskLevel as ModerationRiskLevel] }}</el-tag></template></el-table-column><el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="reportStatusType(row.status as ReportStatus)" effect="plain">{{ reportStatusLabel[row.status as ReportStatus] }}</el-tag></template></el-table-column><el-table-column label="处理人" width="110"><template #default="{ row }">{{ row.assignee ?? '--' }}</template></el-table-column><el-table-column label="提交时间" width="140"><template #default="{ row }">{{ time(row.createdAt) }}</template></el-table-column><el-table-column label="操作" width="90" fixed="right"><template #default="{ row }"><el-button link :icon="DocumentChecked" @click="openReport(row)">查看</el-button></template></el-table-column></el-table>
        <el-pagination v-if="total && isComments" v-model:current-page="commentQuery.page" :page-size="commentQuery.pageSize" :total="total" layout="total, prev, pager, next" @current-change="load" />
        <el-pagination v-else-if="total" v-model:current-page="reportQuery.page" :page-size="reportQuery.pageSize" :total="total" layout="total, prev, pager, next" @current-change="load" />
      </section>
    </section>
    <el-drawer v-model="drawerOpen" :title="isComments ? '评论详情' : '举报详情'" size="540px"><div v-if="activeDetail" class="detail"><template v-if="selectedComment"><section><h3>{{ selectedComment.content }}</h3><p>{{ selectedComment.author }} · {{ selectedComment.videoTitle }} · {{ time(selectedComment.createdAt) }}</p><el-tag :type="commentStatusType(selectedComment.status)">{{ commentStatusLabel[selectedComment.status] }}</el-tag></section><section><h4>回复摘要</h4><ul v-if="selectedComment.replies.length" class="replies"><li v-for="reply in selectedComment.replies" :key="reply.id"><b>{{ reply.author }}</b><span>{{ reply.content }}</span><time>{{ time(reply.createdAt) }}</time></li></ul><p v-else class="muted">暂无回复。</p></section><footer class="drawer-actions"><el-button v-if="selectedComment.status !== 'HIDDEN' && selectedComment.status !== 'DELETED'" type="warning" @click="openAction('HIDE')">隐藏</el-button><el-button v-if="selectedComment.status === 'HIDDEN'" :loading="actionLoading.startsWith('restore-')" @click="restoreComment">恢复</el-button><el-button v-if="selectedComment.status !== 'DELETED'" type="danger" @click="openAction('DELETE')">删除</el-button></footer></template><template v-else-if="selectedReport"><section><h3>{{ selectedReport.targetSummary }}</h3><p>{{ reportTargetLabel[selectedReport.targetType] }} · 举报人 {{ selectedReport.reporter }} · {{ time(selectedReport.createdAt) }}</p><el-tag :type="reportStatusType(selectedReport.status)">{{ reportStatusLabel[selectedReport.status] }}</el-tag></section><section><h4>对象快照</h4><p class="snapshot">{{ selectedReport.targetSnapshot }}</p></section><footer class="drawer-actions"><el-button v-if="selectedReport.status === 'PENDING'" type="primary" :loading="actionLoading.startsWith('claim-')" @click="claimReport">领取举报</el-button><template v-else-if="canDecideReport"><el-button type="success" @click="openAction('RESOLVE')">解决举报</el-button><el-button type="danger" @click="openAction('REJECT')">驳回举报</el-button></template></footer></template><section><h4>处理记录</h4><ol class="history"><li v-for="entry in activeDetail.history" :key="`${entry.action}-${entry.createdAt}`"><b>{{ entry.operator }} · {{ entry.action }}</b><time>{{ time(entry.createdAt) }}</time><p v-if="entry.reason">{{ entry.reason }}</p></li></ol></section></div><el-skeleton v-else :rows="8" animated /></el-drawer>
    <el-dialog v-model="actionOpen" :title="actionTitle" width="460px"><p>请填写处理原因，处理记录将保留在治理历史中。</p><el-input v-model="reason" type="textarea" :rows="4" maxlength="300" show-word-limit placeholder="请输入处理原因" /><template #footer><el-button @click="actionOpen = false">取消</el-button><el-button type="primary" :disabled="!reason.trim()" :loading="Boolean(actionLoading)" @click="submitAction">确认提交</el-button></template></el-dialog>
  </AdminShell>
</template>

<style scoped>
.management-page { display: grid; gap: 16px; }.page-header { display: flex; align-items: end; justify-content: space-between; }.page-header h2 { margin: 0; font-size: 20px; }.page-header p, .detail section > p, .muted { margin: 6px 0 0; color: var(--yl-text-muted); font-size: 12px; }.filters { display: flex; align-items: center; gap: 10px; padding: 14px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.filters .el-input { width: 280px; }.filters .el-select { width: 135px; }.table-shell { overflow: hidden; min-height: 300px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.content-link { max-width: 100%; padding: 0; overflow: hidden; color: var(--yl-text); background: transparent; border: 0; font-weight: 600; text-align: left; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }.content-link:hover { color: var(--yl-indigo); }.video-context { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; overflow: hidden; color: var(--yl-indigo); }.video-context b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.el-table small { display: block; margin-top: 3px; color: var(--yl-text-muted); font-size: 10px; }.el-pagination { justify-content: flex-end; padding: 14px 18px; }.batch-bar { display: flex; align-items: center; gap: 9px; padding: 9px 14px; color: var(--yl-text-secondary); background: #f4f7ff; font-size: 12px; }.error-state { display: grid; justify-items: center; gap: 10px; padding: 70px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.error-state .el-icon { color: var(--yl-coral); font-size: 28px; }.error-state p { margin: 0; }.error-state small { color: var(--yl-text-muted); }.inline-error { padding: 9px 14px; color: #9f3b42; background: #fff6f6; font-size: 12px; }.inline-error button { margin-left: 8px; color: inherit; background: none; border: 0; text-decoration: underline; cursor: pointer; }.detail { display: grid; gap: 20px; }.detail h3, .detail h4 { margin: 0; }.detail section { display: grid; gap: 9px; }.comment-meta { display: flex; gap: 12px; color: var(--yl-text-muted); font-size: 12px; }.detail-video { display: grid; gap: 5px; padding: 12px 14px; color: var(--yl-text-secondary); background: #f4f7ff; border: 1px solid #dce5ff; border-radius: 8px; font-size: 12px; }.detail-video span { color: var(--yl-text-muted); font-size: 11px; }.detail-video strong { display: inline-flex; align-items: center; gap: 6px; color: var(--yl-indigo); font-size: 14px; }.snapshot { padding: 12px; color: var(--yl-text-secondary) !important; background: var(--yl-surface-subtle); border-radius: 6px; line-height: 1.6; }.replies, .history { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }.replies li { display: grid; gap: 4px; padding: 10px; background: var(--yl-surface-subtle); border-radius: 6px; font-size: 12px; }.replies time, .history time { color: var(--yl-text-muted); font-size: 11px; }.history { border-left: 2px solid var(--yl-border); padding-left: 14px; }.history li { position: relative; }.history li::before { position: absolute; top: 3px; left: -19px; width: 8px; height: 8px; content: ''; background: var(--yl-indigo); border-radius: 50%; }.history b, .history time { display: block; font-size: 12px; }.history p { margin: 5px 0 0; color: var(--yl-text-secondary); font-size: 12px; }.drawer-actions { display: flex; gap: 10px; padding-top: 4px; }
</style>
