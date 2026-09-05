import type { AuthorOption, BatchResult, Video, VideoCreate, VideoPage, VideoQuery, VideoRepository, VideoUpdate, VideoUploadInput as ModelVideoUploadInput } from './model';
export type { VideoRepository } from './model';

export interface VideoUploadInput { authorId: string; title: string; description?: string; categoryIds: string[]; tagIds: string[]; visibility: string; file: File }
export interface VideoUploadResult { id?: string; originalMedia?: { id?: string; url?: string; relativePath?: string }; [key: string]: unknown }
interface ApiEnvelope<T> { code: string; message?: string; data?: T; traceId?: string }
export class VideoUploadError extends Error { readonly code?: string; readonly traceId?: string; constructor(message: string, options: { code?: string; traceId?: string } = {}) { super(message); this.name = 'VideoUploadError'; this.code = options.code; this.traceId = options.traceId } }
export async function uploadVideo(input: VideoUploadInput, fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {
  const body = new FormData(); body.append('authorId', input.authorId); body.append('title', input.title);
  if (input.description) body.append('description', input.description);
  input.categoryIds.forEach((id) => body.append('categoryIds', id)); input.tagIds.forEach((id) => body.append('tagIds', id));
  body.append('visibility', input.visibility); body.append('file', input.file);
  const response = await fetcher('/api/v1/admin/videos', { method: 'POST', credentials: 'include', body });
  let envelope: ApiEnvelope<VideoUploadResult>; try { envelope = await response.json() as ApiEnvelope<VideoUploadResult> } catch { throw new VideoUploadError('服务器返回了无效响应') }
  if (!response.ok || envelope.code !== 'OK' || !envelope.data) throw new VideoUploadError(envelope.message || '视频上传失败', { code: envelope.code, traceId: envelope.traceId });
  return { data: envelope.data, traceId: envelope.traceId };
}

type ApiVideo = Partial<Video> & { id: string | number; authorId?: string | number; authorNickname?: string; auditStatus?: string; publishStatus?: string; categories?: Array<{ id: string | number; name: string }>; tags?: string[] | Array<{ id: string | number; name: string }> };
type ApiDetail = ApiVideo & { description?: string; originalMedia?: { durationMs?: number } | null; publishedAt?: string | null };

export class VideoRepositoryError extends Error {
  constructor(message: string, readonly options: { code?: string; traceId?: string } = {}) { super(message); this.name = 'VideoRepositoryError'; }
  get code() { return this.options.code; }
  get traceId() { return this.options.traceId; }
}

async function requestRepository<T>(fetcher: typeof fetch, url: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, { credentials: 'include', headers: { Accept: 'application/json', ...init?.headers }, ...init });
  const body = await response.json() as ApiEnvelope<T>;
  if (!response.ok || body.code !== 'OK' || body.data === undefined) {
    throw new VideoRepositoryError(body.message || '视频操作失败', { code: body.code, traceId: body.traceId ?? response.headers.get('X-Trace-Id') ?? undefined });
  }
  return body.data;
}

function toVideo(video: ApiDetail): Video {
  const categories = video.categories ?? [];
  const tags = video.tags ?? [];
  let status: Video['status'] = 'DRAFT';
  if (video.publishStatus === 'OFF_SHELF') status = 'OFF_SHELF';
  else if (video.publishStatus === 'PUBLISHED') status = 'PUBLISHED';
  else if (video.auditStatus === 'PENDING_REVIEW') status = 'PENDING_REVIEW';
  else if (video.auditStatus === 'REJECTED') status = 'REJECTED';
  return { id: String(video.id), title: video.title ?? '', author: video.authorNickname ?? String(video.authorId ?? ''), category: categories[0]?.name ?? '', tags: Array.isArray(tags) ? tags.map((tag) => typeof tag === 'string' ? tag : (tag as { name: string }).name) : [], status: video.status ?? status, visibility: (video.visibility as Video['visibility']) ?? 'PUBLIC', durationSeconds: video.durationSeconds ?? Math.round((video.originalMedia?.durationMs ?? 0) / 1000), playCount: video.playCount ?? 0, interactionCount: video.interactionCount ?? 0, createdAt: video.createdAt ?? '', updatedAt: video.updatedAt ?? '', publishedAt: video.publishedAt ?? null, description: video.description ?? '', previewUrl: video.previewUrl ?? null, authorId: video.authorId == null ? undefined : String(video.authorId), auditStatus: video.auditStatus, publishStatus: video.publishStatus };
}

export function createHttpVideoRepository(baseUrl = '', fetcher: typeof fetch = globalThis.fetch.bind(globalThis)): VideoRepository {
  const endpoint = (path = '') => `${baseUrl}/api/v1/admin/videos${path}`;
  const id = (value: string) => encodeURIComponent(value);
  const json = (method: 'PATCH' | 'POST', body?: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return {
    async list(query: VideoQuery) {
      const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
      if (query.keyword) params.set('keyword', query.keyword);
      if (query.authorId) params.set('authorId', query.authorId);
      if (query.auditStatus) params.set('auditStatus', query.auditStatus);
      if (query.publishStatus) params.set('publishStatus', query.publishStatus);
      else if (query.status && ['PUBLISHED', 'OFF_SHELF'].includes(query.status)) params.set('publishStatus', query.status);
      else if (query.status) params.set('auditStatus', query.status === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : query.status);
      const page = await requestRepository<{ items: ApiVideo[]; page: number; pageSize: number; total: number }>(fetcher, `${endpoint()}?${params}`);
      return { ...page, items: page.items.map(toVideo) };
    },
    async get(value: string) { return toVideo(await requestRepository<ApiDetail>(fetcher, endpoint(`/${id(value)}`))); },
    async create(input: VideoCreate) { return toVideo(await requestRepository<ApiDetail>(fetcher, endpoint(), json('POST', input))); },
    async update(value: string, input: VideoUpdate) { return toVideo(await requestRepository<ApiDetail>(fetcher, endpoint(`/${id(value)}`), json('PATCH', { title: input.title, description: input.description, visibility: input.visibility, categoryIds: input.category ? [input.category] : [], tagIds: input.tags }))); },
    async submitReview(value: string) { return toVideo(await requestRepository<ApiDetail>(fetcher, endpoint(`/${id(value)}/submit-review`), json('POST'))); },
    async offShelf(value: string, reason: string) { return toVideo(await requestRepository<ApiDetail>(fetcher, endpoint(`/${id(value)}/off-shelf`), json('POST', { reason }))); },
    async restore(value: string) { return toVideo(await requestRepository<ApiDetail>(fetcher, endpoint(`/${id(value)}/restore`), json('POST'))); },
    retryTranscode(value: string) { return requestRepository<null>(fetcher, endpoint(`/${id(value)}/transcodes/720P/retry`), json('POST')); },
    batchOffShelf(ids: string[], reason: string) { return requestRepository<BatchResult>(fetcher, endpoint('/batch/off-shelf'), json('POST', { videoIds: ids, reason })); },
    batchRestore(ids: string[]) { return requestRepository<BatchResult>(fetcher, endpoint('/batch/restore'), json('POST', { videoIds: ids })); },
    async listAuthors() { const page = await requestRepository<{ items: AuthorOption[] }>(fetcher, `${baseUrl}/api/v1/admin/users?page=1&pageSize=100&status=NORMAL`); return page.items; },
    uploadDraft(input: ModelVideoUploadInput) {
      const body = new FormData();
      body.append('authorId', input.authorId); body.append('title', input.title); body.append('description', input.description);
      input.categoryIds.forEach((value) => body.append('categoryIds', value)); input.tagIds.forEach((value) => body.append('tagIds', value));
      body.append('visibility', 'PUBLIC'); body.append('file', input.file);
      return requestRepository<unknown>(fetcher, endpoint(), { method: 'POST', body });
    }
  };
}

export const videoRepositoryKey = Symbol('video-repository');
