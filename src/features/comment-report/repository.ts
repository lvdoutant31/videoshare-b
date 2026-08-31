import type { CommentQuery, CommentReportRepository, ContentReport, ContentReportDetail, ManagedComment, ManagedCommentDetail, PageResult, ReportQuery } from './model';

interface ApiEnvelope<T> {
  code: string;
  message?: string;
  data: T;
  traceId?: string;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class CommentReportRepositoryError extends Error {
  readonly code?: string;
  readonly traceId?: string;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(message: string, options: { code?: string; traceId?: string; status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = 'CommentReportRepositoryError';
    this.code = options.code;
    this.traceId = options.traceId;
    this.status = options.status;
    this.cause = options.cause;
  }
}

async function requestData<T>(fetcher: Fetcher, url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(url, { credentials: 'include', headers: { Accept: 'application/json', ...init?.headers }, ...init });
  } catch (cause) {
    throw new CommentReportRepositoryError('无法连接评论与举报服务', { cause });
  }

  const traceId = response.headers.get('X-Trace-Id') ?? undefined;
  let envelope: ApiEnvelope<T>;
  try {
    envelope = await response.json() as ApiEnvelope<T>;
  } catch (cause) {
    throw new CommentReportRepositoryError('服务返回格式异常', { status: response.status, traceId, cause });
  }

  if (!response.ok || envelope.code !== 'OK') {
    throw new CommentReportRepositoryError(envelope.message || '评论与举报操作失败', {
      code: envelope.code,
      status: response.status,
      traceId: envelope.traceId ?? traceId
    });
  }
  return normalizeIds(envelope.data);
}

function normalizeIds<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(normalizeIds) as T;
  const result = { ...(value as Record<string, unknown>) };
  for (const key of ['id', 'videoId', 'userId', 'targetId', 'parentCommentId']) {
    if (result[key] !== undefined && result[key] !== null) result[key] = String(result[key]);
  }
  for (const [key, item] of Object.entries(result)) result[key] = normalizeIds(item);
  return result as T;
}

export function createHttpCommentReportRepository(baseUrl = '', fetcher: Fetcher = globalThis.fetch.bind(globalThis)): CommentReportRepository {
  const commentsRoot = `${baseUrl}/api/v1/admin/comments`;
  const reportsRoot = `${baseUrl}/api/v1/admin/reports`;
  const id = (value: string) => encodeURIComponent(String(value));
  const json = (method: 'POST' | 'DELETE', body?: unknown): RequestInit => ({
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const pageParams = (page: number, pageSize: number, extras: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    Object.entries(extras).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params;
  };

  return {
    listComments(query: CommentQuery) {
      const params = pageParams(query.page, query.pageSize, { status: query.status });
      return requestData<PageResult<ManagedComment>>(fetcher, `${commentsRoot}?${params}`);
    },
    getComment(commentId) {
      return requestData<ManagedCommentDetail>(fetcher, `${commentsRoot}/${id(commentId)}`);
    },
    hideComment(commentId, reason) {
      return requestData<ManagedCommentDetail>(fetcher, `${commentsRoot}/${id(commentId)}/hide`, json('POST', { reason }));
    },
    restoreComment(commentId) {
      return requestData<ManagedCommentDetail>(fetcher, `${commentsRoot}/${id(commentId)}/restore`, json('POST'));
    },
    deleteComment(commentId, reason) {
      return requestData<ManagedCommentDetail>(fetcher, `${commentsRoot}/${id(commentId)}`, json('DELETE', { reason }));
    },
    async batchHandleComments(commentIds, status, reason) {
      await requestData<null>(fetcher, `${commentsRoot}/batch`, json('POST', { ids: commentIds.map((value) => String(value)), status, reason }));
    },
    listReports(query: ReportQuery) {
      const params = pageParams(query.page, query.pageSize, { status: query.status });
      return requestData<PageResult<ContentReport>>(fetcher, `${reportsRoot}?${params}`);
    },
    getReport(reportId) {
      return requestData<ContentReportDetail>(fetcher, `${reportsRoot}/${id(reportId)}`);
    },
    claimReport(reportId) {
      return requestData<ContentReportDetail>(fetcher, `${reportsRoot}/${id(reportId)}/claim`, json('POST'));
    },
    resolveReport(reportId, note) {
      return requestData<ContentReportDetail>(fetcher, `${reportsRoot}/${id(reportId)}/resolve`, json('POST', { note }));
    },
    rejectReport(reportId, note) {
      return requestData<ContentReportDetail>(fetcher, `${reportsRoot}/${id(reportId)}/reject`, json('POST', { note }));
    }
  };
}

export const commentReportRepositoryKey = Symbol('comment-report-repository');
