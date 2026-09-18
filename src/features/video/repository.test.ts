import { describe, expect, it, vi } from 'vitest';
import { createHttpVideoRepository } from './repository';

const detail = {
  id: '2096791884193673217', title: '测试视频', authorId: '9002',
  categories: [{ id: '2093139032397144065', name: '测试分类' }],
  tags: [{ id: '2093138891560804354', name: '测试标签' }],
  visibility: 'PUBLIC', originalMedia: { url: 'http://localhost:8088/media/old.mp4' }
};
const reply = () => new Response(JSON.stringify({ code: 'OK', data: detail }), {
  status: 200, headers: { 'Content-Type': 'application/json' }
});
const input = { title: '新标题', description: '', visibility: 'PUBLIC' as const,
  categoryIds: ['2093139032397144065'], tagIds: ['2093138891560804354'] };

describe('video edit contract', () => {
  it('keeps taxonomy IDs separate from display names', async () => {
    const repo = createHttpVideoRepository('', vi.fn().mockResolvedValue(reply()));
    const video = await repo.get(detail.id);
    expect(video.categoryIds).toEqual(input.categoryIds);
    expect(video.tagIds).toEqual(input.tagIds);
    expect(video.category).toBe('测试分类');
    expect(video.tags).toEqual(['测试标签']);
  });
  it('sends numeric string IDs in metadata PATCH', async () => {
    const fetcher = vi.fn().mockResolvedValue(reply());
    await createHttpVideoRepository('', fetcher).update(detail.id, input);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('/api/v1/admin/videos/' + detail.id);
    expect(request.method).toBe('PATCH');
    expect(JSON.parse(request.body)).toEqual(input);
  });
  it('posts file uploads to the /upload endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(reply());
    const file = new File(['new-video'], 'create.mp4', { type: 'video/mp4' });
    await createHttpVideoRepository('', fetcher).uploadDraft({
      authorId: '9002', title: '上传测试', description: '', categoryIds: input.categoryIds, tagIds: input.tagIds, file
    });
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('/api/v1/admin/videos/upload');
    expect(request.method).toBe('POST');
    expect(request.body).toBeInstanceOf(FormData);
    expect(request.body.get('file')).toBe(file);
    expect(request.body.has('authorId')).toBe(false);
  });
  it('posts batch deletes to the /batch/delete endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(reply());
    await createHttpVideoRepository('', fetcher).batchDelete([detail.id, '2096791884193673218'], '违规批量清理');
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('/api/v1/admin/videos/batch/delete');
    expect(request.method).toBe('POST');
    expect(JSON.parse(request.body)).toEqual({ videoIds: [detail.id, '2096791884193673218'], reason: '违规批量清理' });
  });
  it('replaces the existing video in one multipart PATCH to /file without creating a draft', async () => {
    const fetcher = vi.fn().mockResolvedValue(reply());
    const file = new File(['new-video'], 'replacement.mp4', { type: 'video/mp4' });
    await createHttpVideoRepository('', fetcher).update(detail.id, { ...input, file });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('/api/v1/admin/videos/' + detail.id + '/file');
    expect(request.method).toBe('PATCH');
    expect(request.body).toBeInstanceOf(FormData);
    expect(request.body.get('file')).toBe(file);
    expect(request.body.has('authorId')).toBe(false);
    expect(request.body.getAll('categoryIds')).toEqual(input.categoryIds);
    expect(request.body.getAll('tagIds')).toEqual(input.tagIds);
    expect(request.headers['Content-Type']).toBeUndefined();
  });
});
