import type { AuthorOption, BatchResult, Video, VideoCreate, VideoPage, VideoQuery, VideoRepository, VideoUpdate, VideoUploadInput } from './model';

interface ApiEnvelope<T> { code: string; message?: string; data: T; traceId?: string; }
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type ApiVideo = Partial<Video> & { id: string | number; authorId?: string | number; authorNickname?: string; auditStatus?: string; publishStatus?: string; categories?: Array<{ id: string | number; name: string }>; tags?: string[] | Array<{ id: string | number; name: string }> };
type ApiDetail = ApiVideo & { description?: string; originalMedia?: { durationMs?: number } | null; publishedAt?: string | null };

export class VideoRepositoryError extends Error {
  constructor(message: string, readonly options: { code?: string; traceId?: string } = {}) { super(message); this.name = 'VideoRepositoryError'; }
  get code() { return this.options.code; }
  get traceId() { return this.options.traceId; }
}

async function request<T>(fetcher: Fetcher, url: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, { credentials: 'include', headers: { Accept: 'application/json', ...init?.headers }, ...init });
  const body = await response.json() as ApiEnvelope<T>;
  if (!response.ok || body.code !== 'OK') throw new VideoRepositoryError(body.message || '视频操作失败', { code: body.code, traceId: body.traceId ?? response.headers.get('X-Trace-Id') ?? undefined });
  return body.data;
}

function statusOf(video: ApiVideo): Video['status'] {
  if (video.publishStatus === 'OFF_SHELF') return 'OFF_SHELF';
  if (video.publishStatus === 'PUBLISHED') return 'PUBLISHED';
  if (video.auditStatus === 'PENDING_REVIEW') return 'PENDING_REVIEW';
  if (video.auditStatus === 'REJECTED') return 'REJECTED';
  return 'DRAFT';
}
function toVideo(video: ApiDetail): Video {
  const categories = video.categories ?? [];
  const tags = video.tags ?? [];
  return { id: String(video.id), title: video.title ?? '', author: video.authorNickname ?? String(video.authorId ?? ''), category: categories[0]?.name ?? '', tags: Array.isArray(tags) ? tags.map((tag) => typeof tag === 'string' ? tag : (tag as { name: string }).name) : [], status: video.status ?? statusOf(video), visibility: (video.visibility as Video['visibility']) ?? 'PUBLIC', durationSeconds: video.durationSeconds ?? Math.round((video.originalMedia?.durationMs ?? 0) / 1000), playCount: video.playCount ?? 0, interactionCount: video.interactionCount ?? 0, createdAt: video.createdAt ?? '', updatedAt: video.updatedAt ?? '', publishedAt: video.publishedAt ?? null, description: video.description ?? '', previewUrl: video.previewUrl ?? null, authorId: video.authorId == null ? undefined : String(video.authorId), auditStatus: video.auditStatus, publishStatus: video.publishStatus };
}

export function createHttpVideoRepository(baseUrl = '', fetcher: Fetcher = globalThis.fetch.bind(globalThis)): VideoRepository {
  const endpoint = (path = '') => `${baseUrl}/api/v1/admin/videos${path}`;
  const json = (method: 'PATCH' | 'POST', body?: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const id = (value: string) => encodeURIComponent(value);
  return {
    async list(query) { const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) }); if (query.keyword) params.set('keyword', query.keyword); if (query.authorId) params.set('authorId', query.authorId); if (query.auditStatus) params.set('auditStatus', query.auditStatus); if (query.publishStatus) params.set('publishStatus', query.publishStatus); else if (query.status && ['PUBLISHED', 'OFF_SHELF'].includes(query.status)) params.set('publishStatus', query.status); else if (query.status) params.set('auditStatus', query.status === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : query.status); const page = await request<{ items: ApiVideo[]; page: number; pageSize: number; total: number }>(fetcher, `${endpoint()}?${params}`); return { ...page, items: page.items.map(toVideo) }; },
    async get(value) { return toVideo(await request<ApiDetail>(fetcher, endpoint(`/${id(value)}`))); },
    async create(input) { return toVideo(await request<ApiDetail>(fetcher, endpoint(), json('POST', input))); },
    async update(value, input) { return toVideo(await request<ApiDetail>(fetcher, endpoint(`/${id(value)}`), json('PATCH', { title: input.title, description: input.description, visibility: input.visibility, categoryIds: input.category ? [input.category] : [], tagIds: input.tags }))); },
    async submitReview(value) { return toVideo(await request<ApiDetail>(fetcher, endpoint(`/${id(value)}/submit-review`), json('POST'))); },
    async offShelf(value, reason) { return toVideo(await request<ApiDetail>(fetcher, endpoint(`/${id(value)}/off-shelf`), json('POST', { reason }))); },
    async restore(value) { return toVideo(await request<ApiDetail>(fetcher, endpoint(`/${id(value)}/restore`), json('POST'))); },
    retryTranscode(value) { return request<null>(fetcher, endpoint(`/${id(value)}/transcodes/720P/retry`), json('POST')); },
    batchOffShelf(ids, reason) { return request<BatchResult>(fetcher, endpoint('/batch/off-shelf'), json('POST', { videoIds: ids, reason })); },
    batchRestore(ids) { return request<BatchResult>(fetcher, endpoint('/batch/restore'), json('POST', { videoIds: ids })); },
    async createSimulatedUpload() { throw new VideoRepositoryError('真实接口模式暂不支持上传，请等待媒体上传服务就绪'); },
    async listAuthors() { const page = await request<{ items: AuthorOption[] }>(fetcher, `${baseUrl}/api/v1/admin/users?page=1&pageSize=100&status=NORMAL`); return page.items; },
    uploadDraft(input: VideoUploadInput) { const body = new FormData(); body.append('authorId', input.authorId); body.append('title', input.title); if (input.description) body.append('description', input.description); input.categoryIds.forEach((id) => body.append('categoryIds', id)); input.tagIds.forEach((id) => body.append('tagIds', id)); body.append('visibility', 'PUBLIC'); body.append('file', input.file); return request<unknown>(fetcher, endpoint(), { method: 'POST', body }); }
  };
}

export const videoRepositoryKey = Symbol('video-repository');
