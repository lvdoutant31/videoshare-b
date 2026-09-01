export type VideoStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'OFF_SHELF' | 'TRANSCODING' | 'TRANSCODE_FAILED' | 'REJECTED';
export type VideoAction = 'edit' | 'submitReview' | 'offShelf' | 'restore' | 'retryTranscode';

export interface Video {
  id: string;
  title: string;
  author: string;
  category: string;
  tags: string[];
  status: VideoStatus;
  visibility: 'PUBLIC' | 'INTERNAL';
  durationSeconds: number;
  playCount: number;
  interactionCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  description: string;
  previewUrl: string | null;
  transcodeError?: string;
  offShelfReason?: string;
  isSimulated?: boolean;
  authorId?: string;
  auditStatus?: string;
  publishStatus?: string;
}

/** Query names mirror the admin API contract. */
export interface VideoQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  authorId?: string;
  auditStatus?: string;
  publishStatus?: string;
  /** Backwards-compatible UI filters; repository maps these to API statuses. */
  status?: VideoStatus;
  category?: string;
}
export interface VideoPage { items: Video[]; page: number; pageSize: number; total: number; }
export interface VideoUpdate { title: string; description: string; category: string; tags: string[]; visibility: Video['visibility']; }
export interface VideoCreate { authorId: string; originalMediaId: string; coverMediaId?: string; title: string; description?: string; sourceNote?: string; categoryIds?: string[]; tagIds?: string[]; visibility?: Video['visibility']; }
export interface AuthorOption {
  id: string;
  nickname: string;
  status: string;
}

export interface VideoUploadInput {
  authorId: string;
  title: string;
  description: string;
  categoryIds: string[];
  tagIds: string[];
  file: File;
}

export interface BatchResult { succeededIds: string[]; failed: Array<{ id: string; message: string }>; }

export const statusLabel: Record<VideoStatus, string> = { DRAFT: '草稿', PENDING_REVIEW: '待审核', PUBLISHED: '已发布', OFF_SHELF: '已下架', TRANSCODING: '转码中', TRANSCODE_FAILED: '转码失败', REJECTED: '已驳回' };
export const allowedActions: Record<VideoStatus, VideoAction[]> = {
  DRAFT: ['edit', 'submitReview'], PENDING_REVIEW: ['edit'], PUBLISHED: ['edit', 'offShelf'], OFF_SHELF: ['edit', 'restore'], TRANSCODING: [], TRANSCODE_FAILED: ['retryTranscode'], REJECTED: ['edit', 'submitReview']
};

export interface VideoRepository {
  list(query: VideoQuery): Promise<VideoPage>;
  get(id: string): Promise<Video>;
  create(input: VideoCreate): Promise<Video>;
  update(id: string, input: VideoUpdate): Promise<Video>;
  submitReview(id: string): Promise<Video>;
  offShelf(id: string, reason: string): Promise<Video>;
  restore(id: string): Promise<Video>;
  retryTranscode(id: string): Promise<Video | null>;
  batchOffShelf(ids: string[], reason: string): Promise<BatchResult>;
  batchRestore(ids: string[]): Promise<BatchResult>;
  listAuthors(): Promise<AuthorOption[]>;
  uploadDraft(input: VideoUploadInput): Promise<unknown>;
}
