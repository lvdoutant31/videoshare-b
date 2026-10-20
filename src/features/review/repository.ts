import type { ReviewDecisionInput, ReviewFinding, ReviewHistory, ReviewPage, ReviewQuery, ReviewRepository, ReviewTask, ReviewTaskStatus } from './model';

interface ApiEnvelope<T> { code: string; message?: string; data: T; traceId?: string; }
interface ApiQueueItem { id: string; authorId: string; authorNickname: string; title: string; riskLevel: string; currentVersion: number; submittedAt: string; }
interface ApiDetail { id: string; authorId: string; authorNickname: string; title: string; description?: string; originalMedia?: { url?: string | null; contentType?: string | null }; auditStatus: string; riskLevel?: string; currentVersion: number; categories?: { id: string; name: string }[]; tags?: { id: string; name: string }[]; createdAt: string; updatedAt: string; }
interface ApiHistory { id: string; videoVersion: number; reviewerAdminId: string | null; action: string; reason: string | null; claimedAt: string | null; reviewedAt: string | null; createdAt: string; }
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class ReviewRepositoryError extends Error {
  constructor(message: string, readonly options: { code?: string; traceId?: string } = {}) { super(message); this.name = 'ReviewRepositoryError'; }
  get code() { return this.options.code; }
  get traceId() { return this.options.traceId; }
}

async function request<T>(fetcher: Fetcher, url: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, { credentials: 'include', headers: { Accept: 'application/json', ...init?.headers }, ...init });
  const body = await response.json() as ApiEnvelope<T>;
  if (!response.ok || body.code !== 'OK') throw new ReviewRepositoryError(body.message || '审核任务操作失败', { code: body.code, traceId: body.traceId ?? response.headers.get('X-Trace-Id') ?? undefined });
  return body.data;
}

const statusOf = (status: string): ReviewTaskStatus => status === 'PENDING_REVIEW' ? 'PENDING' : status === 'CLAIMED' ? 'CLAIMED' : status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'REVISION_REQUIRED';
const historyAction = (action: string): ReviewHistory['action'] => action === 'CLAIMED' ? 'CLAIMED' : action === 'APPROVED' ? 'APPROVED' : action === 'REJECTED' ? 'REJECTED' : action === 'REVISION_REQUIRED' ? 'REVISION_REQUIRED' : 'SUBMITTED';

function toTask(detail: ApiDetail, history: ApiHistory[] = [], submittedAt = detail.createdAt): ReviewTask {
  const status = statusOf(detail.auditStatus);
  const claimant = history.find((entry) => entry.action === 'CLAIMED')?.reviewerAdminId;
  return {
    id: detail.id, videoId: detail.id, title: detail.title, author: detail.authorNickname, category: detail.categories?.[0]?.name ?? '--',
    tags: detail.tags?.map((tag) => tag.name) ?? [], description: detail.description ?? '', durationSeconds: 0,
    videoUrl: detail.originalMedia?.url ?? null, submittedAt,
    status, riskLevel: (detail.riskLevel ?? 'LOW') as ReviewTask['riskLevel'], findings: [] as ReviewFinding[],
    claimedBy: status === 'CLAIMED' ? (claimant ? `管理员 ${claimant}` : '未知审核员') : null, claimToken: null, version: detail.currentVersion,
    history: history.map((entry) => ({ action: historyAction(entry.action), operator: entry.reviewerAdminId ?? '系统', createdAt: entry.createdAt, reason: entry.reason ?? undefined }))
  };
}

export function createHttpReviewRepository(baseUrl = '', fetcher: Fetcher = globalThis.fetch.bind(globalThis)): ReviewRepository {
  const root = `${baseUrl}/api/v1/admin/reviews/videos`;
  const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const path = (id: string, suffix = '') => `${root}/${encodeURIComponent(id)}${suffix}`;
  async function detail(id: string, submittedAt?: string) { const item = await request<ApiDetail>(fetcher, path(id)); const history = await request<ApiHistory[]>(fetcher, path(id, '/history')); return toTask(item, history, submittedAt); }
  return {
    async list(query) {
      const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
      if (query.keyword) params.set('keyword', query.keyword); if (query.authorId) params.set('authorId', query.authorId); if (query.riskLevel) params.set('riskLevel', query.riskLevel);
      const page = await request<{ items: ApiQueueItem[]; page: number; pageSize: number; total: number }>(fetcher, `${root}?${params}`);
      const items = await Promise.all(page.items.map((item) => detail(item.id, item.submittedAt)));
      return { items, page: page.page, pageSize: page.pageSize, total: page.total } satisfies ReviewPage;
    },
    get: detail,
    async claim(id, version) { return toTask(await request<ApiDetail>(fetcher, path(id, '/claim'), json({ version })), await request<ApiHistory[]>(fetcher, path(id, '/history'))); },
    async decide(id, input: ReviewDecisionInput) {
      const suffix = input.decision === 'APPROVE' ? '/approve' : input.decision === 'REJECT' ? '/reject' : '/request-revision';
      const body = { currentVersion: input.currentVersion, ...(input.reason === undefined ? {} : { reason: input.reason }) };
      return toTask(await request<ApiDetail>(fetcher, path(id, suffix), json(body)), await request<ApiHistory[]>(fetcher, path(id, '/history')));
    }
  };
}

export const reviewRepositoryKey = Symbol('review-repository');
