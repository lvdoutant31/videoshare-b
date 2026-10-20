import { VideoRepositoryError } from './repository';
import type { AuthorOption, BatchResult, Video, VideoCreate, VideoPage, VideoQuery, VideoRepository, VideoUpdate, VideoUploadInput } from './model';

const time = '2026-08-27T08:00:00.000Z';
const clone = <T>(value: T): T => structuredClone(value);

export function createMockVideoRepository(): VideoRepository {
  let nextId = 10010;
  let videos: Video[] = [
    { id: '10001', title: '客户现场安全操作要点', author: '安全培训组', category: '安全生产', tags: ['安全规范', '设备巡检'], status: 'PUBLISHED', visibility: 'PUBLIC', durationSeconds: 326, watchTimeMs: 482000, playCount: 24860, interactionCount: 1834, createdAt: time, updatedAt: time, publishedAt: '2026-08-27T01:00:00.000Z', description: '现场作业规范说明。', previewUrl: null },
    { id: '10002', title: '新员工入职培训', author: '人力资源中心', category: '技能培训', tags: ['入职培训'], status: 'PENDING_REVIEW', visibility: 'PRIVATE', durationSeconds: 512, watchTimeMs: 0, playCount: 0, interactionCount: 0, createdAt: time, updatedAt: time, publishedAt: null, description: '入职第一课。', previewUrl: null },
    { id: '10003', title: '设备巡检标准流程', author: '设备管理部', category: '安全生产', tags: ['设备巡检'], status: 'TRANSCODE_FAILED', visibility: 'PUBLIC', durationSeconds: 421, watchTimeMs: 0, playCount: 0, interactionCount: 0, createdAt: time, updatedAt: time, publishedAt: null, description: '设备巡检操作流程。', previewUrl: null, transcodeError: '720P 转码任务异常结束' },
    { id: '10004', title: '企业文化开放日纪实', author: '品牌中心', category: '企业文化', tags: ['往期活动'], status: 'OFF_SHELF', visibility: 'PUBLIC', durationSeconds: 286, watchTimeMs: 315000, playCount: 18240, interactionCount: 920, createdAt: time, updatedAt: time, publishedAt: '2026-08-25T03:30:00.000Z', description: '开放日活动记录。', previewUrl: null, offShelfReason: '内容需要更新' },
    { id: '10005', title: '新版员工守则解读', author: '人力资源中心', category: '技能培训', tags: ['入职培训'], status: 'DRAFT', visibility: 'PRIVATE', durationSeconds: 180, watchTimeMs: 0, playCount: 0, interactionCount: 0, createdAt: time, updatedAt: time, publishedAt: null, description: '待补充发布信息。', previewUrl: null },
    { id: '10006', title: '季度安全复盘', author: '安全培训组', category: '安全生产', tags: ['安全规范'], status: 'REJECTED', visibility: 'PUBLIC', durationSeconds: 240, watchTimeMs: 0, playCount: 0, interactionCount: 0, createdAt: time, updatedAt: time, publishedAt: null, description: '审核反馈后待修改。', previewUrl: null },
    { id: '10007', title: '一线岗位技能分享', author: '生产管理部', category: '技能培训', tags: [], status: 'TRANSCODING', visibility: 'PUBLIC', durationSeconds: 360, watchTimeMs: 0, playCount: 0, interactionCount: 0, createdAt: time, updatedAt: time, publishedAt: null, description: '正在生成多清晰度版本。', previewUrl: null }
  ];
  const find = (id: string) => { const video = videos.find((item) => item.id === id); if (!video) throw new VideoRepositoryError('视频不存在', { code: 'VIDEO_NOT_FOUND' }); return video; };
  const update = (id: string, patch: Partial<Video>) => { const index = videos.findIndex((item) => item.id === id); const result = { ...videos[index], ...patch, updatedAt: time }; videos[index] = result; return clone(result); };
  const batch = async (ids: string[], status: Video['status'], reason?: string): Promise<BatchResult> => { const succeededIds: string[] = []; const failed: BatchResult['failed'] = []; for (const id of ids) { const item = find(id); if (item.status !== status) failed.push({ id, message: '当前状态不支持此操作' }); else { succeededIds.push(id); update(id, status === 'PUBLISHED' ? { status: 'OFF_SHELF', offShelfReason: reason } : { status: 'PUBLISHED', offShelfReason: undefined, publishedAt: time }); } } return { succeededIds, failed }; };
  return {
    async list(query: VideoQuery): Promise<VideoPage> { const result = videos.filter((item) => (!query.keyword || `${item.id}${item.title}${item.author}`.includes(query.keyword)) && (!query.status || item.status === query.status) && (!query.category || item.category === query.category)).sort((a, b) => Number(b.id) - Number(a.id)); const start = (query.page - 1) * query.pageSize; return { items: clone(result.slice(start, start + query.pageSize)), page: query.page, pageSize: query.pageSize, total: result.length }; },
    async get(id) { return clone(find(id)); },
    async create(input: VideoCreate) { const video: Video = { id: String(nextId++), title: input.title, author: '当前管理员', category: '未分类', tags: [], status: 'DRAFT', visibility: input.visibility ?? 'PUBLIC', durationSeconds: 0, watchTimeMs: 0, playCount: 0, interactionCount: 0, createdAt: time, updatedAt: time, publishedAt: null, description: input.description ?? '', previewUrl: null }; videos.push(video); return clone(video); },
    async update(id, input: VideoUpdate) { if (!input.title.trim()) throw new VideoRepositoryError('标题不能为空', { code: 'VALIDATION_FAILED' }); return update(id, { ...input, title: input.title.trim() }); },
    async publish(id) { const item = find(id); if (item.status !== 'APPROVED') throw new VideoRepositoryError('仅待发布视频可以发布', { code: 'INVALID_STATUS' }); return update(id, { status: 'PUBLISHED', auditStatus: 'APPROVED', publishStatus: 'PUBLISHED', publishedAt: time }); },
    async submitReview(id) { const item = find(id); if (!['DRAFT', 'REJECTED', 'REVISION_REQUIRED'].includes(item.status)) throw new VideoRepositoryError('当前状态不能提交审核', { code: 'INVALID_STATUS' }); return update(id, { status: 'PENDING_REVIEW', auditStatus: 'PENDING_REVIEW', publishStatus: 'UNPUBLISHED' }); },
    async offShelf(id, reason) { const item = find(id); if (item.status !== 'PUBLISHED') throw new VideoRepositoryError('仅已发布视频可以下架', { code: 'INVALID_STATUS' }); if (!reason.trim()) throw new VideoRepositoryError('请输入下架原因', { code: 'VALIDATION_FAILED' }); return update(id, { status: 'OFF_SHELF', offShelfReason: reason.trim() }); },
    async restore(id) { const item = find(id); if (item.status !== 'OFF_SHELF') throw new VideoRepositoryError('仅已下架视频可以重新提交审核', { code: 'INVALID_STATUS' }); return update(id, { status: 'PENDING_REVIEW', auditStatus: 'PENDING_REVIEW', publishStatus: 'UNPUBLISHED', offShelfReason: undefined, publishedAt: null }); },
    async retryTranscode(id) { const item = find(id); if (item.status !== 'TRANSCODE_FAILED') throw new VideoRepositoryError('当前没有失败的转码任务', { code: 'INVALID_STATUS' }); return update(id, { status: 'TRANSCODING', transcodeError: undefined }); },
    batchOffShelf(ids, reason) { if (!reason.trim()) throw new VideoRepositoryError('请输入下架原因', { code: 'VALIDATION_FAILED' }); return batch(ids, 'PUBLISHED', reason); },
    async batchRestore(ids) { const succeededIds: string[] = []; const failed: BatchResult['failed'] = []; for (const id of ids) { const item = find(id); if (item.status !== 'OFF_SHELF') { if (item.status === 'PENDING_REVIEW') succeededIds.push(id); else failed.push({ id, message: '当前状态不支持重新提交审核' }); } else { succeededIds.push(id); update(id, { status: 'PENDING_REVIEW', auditStatus: 'PENDING_REVIEW', publishStatus: 'UNPUBLISHED', offShelfReason: undefined, publishedAt: null }); } } return { succeededIds, failed }; },
    async batchDelete(ids: string[], reason: string): Promise<BatchResult> {
      if (!reason.trim()) throw new VideoRepositoryError('请输入删除原因', { code: 'VALIDATION_FAILED' });
      const succeededIds: string[] = []; const failed: BatchResult['failed'] = [];
      for (const id of ids) { try { find(id); videos = videos.filter((item) => item.id !== id); succeededIds.push(id); } catch (caught) { if (caught instanceof VideoRepositoryError) failed.push({ id, message: caught.message }); } }
      return { succeededIds, failed };
    },
    async listAuthors(): Promise<AuthorOption[]> { return []; },
    async uploadDraft(_input: VideoUploadInput) { return { id: 'mock-upload' }; }
  };
}
