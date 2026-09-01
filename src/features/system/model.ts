export interface OperationLog {
  id: string;
  traceId: string;
  actorId: string;
  actorName: string;
  module: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string | null;
  ip: string | null;
  requestMethod: string;
  requestPath: string;
  requestParams: string | null;
  status: 'SUCCESS' | 'FAILURE';
  errorCode: string | null;
  durationMs: number;
  createdAt: string;
}

export interface OperationLogPage {
  items: OperationLog[];
  page: number;
  pageSize: number;
  total: number;
}

export interface OperationLogQuery {
  page: number;
  pageSize: number;
  module?: string;
  action?: string;
  actorId?: string;
  targetType?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
}

export const moduleLabels: Record<string, string> = {
  VIDEO: '视频管理',
  REVIEW: '审核管理',
  MODERATION: '内容处置',
  USER: '用户管理',
  TAXONOMY: '分类标签',
  AUTH: '认证登录',
};

export const actionLabels: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
  PUBLISH: '发布',
  SCHEDULE: '定时发布',
  CANCEL: '取消',
  OFF_SHELF: '下架',
  RESTORE: '恢复',
  SUBMIT: '提交',
  APPROVE: '通过',
  REJECT: '驳回',
  CLAIM: '认领',
  REQUEST_REVISION: '要求修改',
  HIDE: '隐藏',
  BATCH: '批量操作',
  BATCH_OFF_SHELF: '批量下架',
  BATCH_RESTORE: '批量恢复',
  MUTE: '禁言',
  SUSPEND: '临时封禁',
  BAN: '永久封禁',
  REVOKE: '撤销处罚',
  UNBIND: '解绑企微',
  CONFIRM: '封禁确认',
  RETRY: '重试',
  RESOLVE: '解决',
  LOGIN: '登录',
  LOGOUT: '登出',
};

export interface OperationLogRepository {
  list(query: OperationLogQuery): Promise<OperationLogPage>;
}
