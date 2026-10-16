export type CommentStatus = 'PENDING' | 'NORMAL' | 'HIDDEN' | 'DELETED';
export type ReportStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';
export type ModerationRiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export type ReportTargetType = 'VIDEO' | 'COMMENT' | 'USER';

export interface CommentQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: CommentStatus;
  riskLevel?: ModerationRiskLevel;
}

export interface ReportQuery {
  page: number;
  pageSize: number;
  targetType?: ReportTargetType;
  status?: ReportStatus;
  riskLevel?: ModerationRiskLevel;
}

export interface ModerationHistory {
  action: string;
  operator: string;
  createdAt: string;
  reason?: string;
}

export interface ManagedComment {
  id: string;
  videoId: string;
  videoTitle: string;
  author: string;
  content: string;
  status: CommentStatus;
  riskLevel: ModerationRiskLevel;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  handledReason: string | null;
}

export interface ManagedCommentDetail extends ManagedComment {
  parentCommentId: string | null;
  replies: Array<{ id: string; author: string; content: string; createdAt: string }>;
  history: ModerationHistory[];
}

export interface ContentReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetSummary: string;
  reporter: string;
  reason: string;
  description?: string | null;
  riskLevel: ModerationRiskLevel;
  status: ReportStatus;
  assignee: string | null;
  assigneeAdminId?: string | null;
  createdAt: string;
  resolution: string | null;
  resolutionNote?: string | null;
}

export interface ContentReportDetail extends ContentReport {
  targetSnapshot: string;
  history: ModerationHistory[];
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CommentReportRepository {
  listComments(query: CommentQuery): Promise<PageResult<ManagedComment>>;
  getComment(commentId: string): Promise<ManagedCommentDetail>;
  hideComment(commentId: string, reason: string): Promise<ManagedCommentDetail>;
  restoreComment(commentId: string): Promise<ManagedCommentDetail>;
  deleteComment(commentId: string, reason: string): Promise<ManagedCommentDetail>;
  batchHandleComments(commentIds: string[], status: 'HIDDEN' | 'NORMAL' | 'DELETED', reason?: string): Promise<void>;
  listReports(query: ReportQuery): Promise<PageResult<ContentReport>>;
  getReport(reportId: string): Promise<ContentReportDetail>;
  claimReport(reportId: string): Promise<ContentReportDetail>;
  resolveReport(reportId: string, note: string): Promise<ContentReportDetail>;
  rejectReport(reportId: string, note: string): Promise<ContentReportDetail>;
}

export const commentStatusLabel: Record<CommentStatus, string> = {
  PENDING: '待审核',
  NORMAL: '正常',
  HIDDEN: '已隐藏',
  DELETED: '已删除'
};

export const reportStatusLabel: Record<ReportStatus, string> = {
  PENDING: '待领取',
  PROCESSING: '处理中',
  RESOLVED: '已解决',
  REJECTED: '已驳回'
};

export const riskLevelLabel: Record<ModerationRiskLevel, string> = {
  NONE: '无风险',
  LOW: '低风险',
  MEDIUM: '中风险',
  HIGH: '高风险'
};

export const reportTargetLabel: Record<ReportTargetType, string> = {
  VIDEO: '视频',
  COMMENT: '评论',
  USER: '用户'
};
