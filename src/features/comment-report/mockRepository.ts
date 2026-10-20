import type { CommentQuery, CommentReportRepository, ContentReport, ContentReportDetail, ManagedComment, ManagedCommentDetail, ModerationHistory, ReportQuery } from './model';
import { CommentReportRepositoryError } from './repository';
import { authState } from '../auth/repository';

const now = '2026-08-28T08:00:00.000Z';
const clone = <T>(value: T): T => structuredClone(value);

function requireReason(reason: string) {
  if (!reason.trim()) throw new CommentReportRepositoryError('请填写处理原因', { code: 'VALIDATION_FAILED' });
}

export function createMockCommentReportRepository(): CommentReportRepository {
  let comments: ManagedCommentDetail[] = [
    { id: 'comment-101', videoId: 'video-501', videoTitle: '车间安全巡检规范', author: '林晓雯', content: '这类内容没有实际帮助。', status: 'NORMAL', riskLevel: 'MEDIUM', likeCount: 3, replyCount: 1, createdAt: '2026-08-28T05:20:00.000Z', handledReason: null, parentCommentId: null, replies: [{ id: 'comment-102', author: '陈思远', content: '请就具体问题反馈。', createdAt: '2026-08-28T05:25:00.000Z' }], history: [{ action: '发布', operator: '林晓雯', createdAt: '2026-08-28T05:20:00.000Z' }] },
    { id: 'comment-103', videoId: 'video-502', videoTitle: '设备点检实操演示', author: '匿名用户', content: '联系方式加我，提供代办服务。', status: 'PENDING', riskLevel: 'HIGH', likeCount: 0, replyCount: 0, createdAt: '2026-08-28T04:10:00.000Z', handledReason: null, parentCommentId: null, replies: [], history: [{ action: '进入审核', operator: '系统', createdAt: '2026-08-28T04:10:00.000Z' }] },
    { id: 'comment-104', videoId: 'video-503', videoTitle: '新员工入场培训', author: '魏明', content: '请联系我获取免费资料。', status: 'HIDDEN', riskLevel: 'MEDIUM', likeCount: 1, replyCount: 0, createdAt: '2026-08-27T08:10:00.000Z', handledReason: '涉嫌营销引流', parentCommentId: null, replies: [], history: [{ action: '隐藏', operator: '当前管理员', createdAt: '2026-08-27T09:00:00.000Z', reason: '涉嫌营销引流' }] },
    { id: 'comment-105', videoId: 'video-504', videoTitle: '生产流程优化分享', author: '周启航', content: '无关攻击性言论', status: 'DELETED', riskLevel: 'HIGH', likeCount: 0, replyCount: 0, createdAt: '2026-08-26T02:10:00.000Z', handledReason: '严重违反社区规范', parentCommentId: null, replies: [], history: [{ action: '删除', operator: '王审核', createdAt: '2026-08-26T03:00:00.000Z', reason: '严重违反社区规范' }] }
  ];
  let reports: ContentReportDetail[] = [
    { id: 'report-201', targetType: 'COMMENT', targetId: 'comment-101', targetSummary: '这类内容没有实际帮助。', reporter: '陈思远', reason: '人身攻击或不友善内容', riskLevel: 'MEDIUM', status: 'PENDING', assignee: null, createdAt: '2026-08-28T06:00:00.000Z', resolution: null, targetSnapshot: '视频《车间安全巡检规范》下的评论：这类内容没有实际帮助。', history: [{ action: '提交举报', operator: '陈思远', createdAt: '2026-08-28T06:00:00.000Z' }] },
    { id: 'report-202', targetType: 'VIDEO', targetId: 'video-502', targetSummary: '设备点检实操演示', reporter: '林晓雯', reason: '疑似违规营销', riskLevel: 'HIGH', status: 'PROCESSING', assignee: '当前管理员', assigneeAdminId: authState.session?.id ?? 'mock-admin', createdAt: '2026-08-28T03:40:00.000Z', resolution: null, targetSnapshot: '视频标题：设备点检实操演示；举报说明：疑似违规营销。', history: [{ action: '领取', operator: '当前管理员', createdAt: '2026-08-28T04:00:00.000Z' }] },
    { id: 'report-203', targetType: 'USER', targetId: '10006', targetSummary: '魏明', reporter: '陈思远', reason: '发布垃圾信息', riskLevel: 'LOW', status: 'RESOLVED', assignee: '李审核', createdAt: '2026-08-27T08:00:00.000Z', resolution: '已完成核查并记录处理结论', targetSnapshot: '用户：魏明；历史违规次数：1。', history: [{ action: '解决', operator: '李审核', createdAt: '2026-08-27T09:00:00.000Z', reason: '已完成核查并记录处理结论' }] },
    { id: 'report-204', targetType: 'COMMENT', targetId: 'comment-104', targetSummary: '请联系我获取免费资料。', reporter: '周启航', reason: '其他', riskLevel: 'LOW', status: 'REJECTED', assignee: '王审核', createdAt: '2026-08-26T05:00:00.000Z', resolution: '举报证据不足', targetSnapshot: '视频《新员工入场培训》下的评论：请联系我获取免费资料。', history: [{ action: '驳回', operator: '王审核', createdAt: '2026-08-26T06:00:00.000Z', reason: '举报证据不足' }] }
  ];

  const commentItem = (comment: ManagedCommentDetail): ManagedComment => {
    const { parentCommentId, replies, history, ...item } = comment;
    return item;
  };
  const findComment = (commentId: string) => {
    const comment = comments.find((item) => item.id === commentId);
    if (!comment) throw new CommentReportRepositoryError('评论不存在或已不可见', { code: 'COMMENT_NOT_FOUND' });
    return comment;
  };
  const findReport = (reportId: string) => {
    const report = reports.find((item) => item.id === reportId);
    if (!report) throw new CommentReportRepositoryError('举报不存在或已不可见', { code: 'REPORT_NOT_FOUND' });
    return report;
  };
  const replaceComment = (comment: ManagedCommentDetail) => {
    comments = comments.map((item) => item.id === comment.id ? comment : item);
    return clone(comment);
  };
  const replaceReport = (report: ContentReportDetail) => {
    reports = reports.map((item) => item.id === report.id ? report : item);
    return clone(report);
  };
  const history = (action: string, reason?: string): ModerationHistory => ({ action, operator: '当前管理员', createdAt: now, reason });

  return {
    async listComments(query: CommentQuery) {
      const keyword = query.keyword?.trim();
      const matched = comments.filter((comment) => (!keyword || `${comment.id}${comment.videoId}${comment.videoTitle}${comment.author}${comment.content}`.includes(keyword)) && (!query.status || comment.status === query.status) && (!query.riskLevel || comment.riskLevel === query.riskLevel));
      const start = (query.page - 1) * query.pageSize;
      return { items: clone(matched.slice(start, start + query.pageSize).map(commentItem)), page: query.page, pageSize: query.pageSize, total: matched.length };
    },
    async getComment(commentId) { return clone(findComment(commentId)); },
    async hideComment(commentId, reason) {
      requireReason(reason);
      const comment = findComment(commentId);
      if (comment.status === 'HIDDEN') throw new CommentReportRepositoryError('评论当前已隐藏', { code: 'STATE_CONFLICT' });
      if (comment.status === 'DELETED') throw new CommentReportRepositoryError('已删除评论不能隐藏', { code: 'STATE_CONFLICT' });
      return replaceComment({ ...comment, status: 'HIDDEN', handledReason: reason.trim(), history: [history('隐藏', reason.trim()), ...comment.history] });
    },
    async restoreComment(commentId) {
      const comment = findComment(commentId);
      if (comment.status !== 'HIDDEN') throw new CommentReportRepositoryError('仅已隐藏评论可以恢复', { code: 'STATE_CONFLICT' });
      return replaceComment({ ...comment, status: 'NORMAL', handledReason: null, history: [history('恢复'), ...comment.history] });
    },
    async deleteComment(commentId, reason) {
      requireReason(reason);
      const comment = findComment(commentId);
      if (comment.status === 'DELETED') throw new CommentReportRepositoryError('评论当前已删除', { code: 'STATE_CONFLICT' });
      return replaceComment({ ...comment, status: 'DELETED', handledReason: reason.trim(), history: [history('删除', reason.trim()), ...comment.history] });
    },
    async batchHandleComments(commentIds, status, reason) {
      if (!commentIds.length) throw new CommentReportRepositoryError('请选择至少一条评论', { code: 'VALIDATION_FAILED' });
      if (status !== 'NORMAL') requireReason(reason ?? '');
      for (const commentId of commentIds) {
        const comment = findComment(commentId);
        if (comment.status === status) throw new CommentReportRepositoryError('评论状态未变化', { code: 'STATE_CONFLICT' });
        replaceComment({ ...comment, status, handledReason: reason?.trim() ?? null, history: [history(status, reason?.trim()), ...comment.history] });
      }
    },
    async listReports(query: ReportQuery) {
      const matched = reports.filter((report) => (!query.targetType || report.targetType === query.targetType) && (!query.status || report.status === query.status) && (!query.riskLevel || report.riskLevel === query.riskLevel));
      const start = (query.page - 1) * query.pageSize;
      const items: ContentReport[] = matched.slice(start, start + query.pageSize).map(({ targetSnapshot, history, ...item }) => item);
      return { items: clone(items), page: query.page, pageSize: query.pageSize, total: matched.length };
    },
    async getReport(reportId) { return clone(findReport(reportId)); },
    async claimReport(reportId) {
      const report = findReport(reportId);
      if (report.status !== 'PENDING') throw new CommentReportRepositoryError('举报已被领取或已处理', { code: 'REPORT_ALREADY_CLAIMED' });
      return replaceReport({ ...report, status: 'PROCESSING', assignee: '当前管理员', assigneeAdminId: authState.session?.id ?? 'mock-admin', history: [history('领取'), ...report.history] });
    },
    async resolveReport(reportId, note) {
      requireReason(note);
      const report = findReport(reportId);
      if (report.status !== 'PROCESSING' || report.assigneeAdminId !== (authState.session?.id ?? 'mock-admin')) throw new CommentReportRepositoryError('仅当前处理人可以解决举报', { code: 'REPORT_NOT_CLAIMED_BY_CURRENT_OPERATOR' });
      return replaceReport({ ...report, status: 'RESOLVED', resolution: 'RESOLVED', resolutionNote: note.trim(), history: [history('解决', note.trim()), ...report.history] });
    },
    async rejectReport(reportId, note) {
      requireReason(note);
      const report = findReport(reportId);
      if (report.status !== 'PROCESSING' || report.assigneeAdminId !== (authState.session?.id ?? 'mock-admin')) throw new CommentReportRepositoryError('仅当前处理人可以驳回举报', { code: 'REPORT_NOT_CLAIMED_BY_CURRENT_OPERATOR' });
      return replaceReport({ ...report, status: 'REJECTED', resolution: 'REJECTED', resolutionNote: note.trim(), history: [history('驳回', note.trim()), ...report.history] });
    }
  };
}
