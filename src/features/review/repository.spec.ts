import { describe, expect, it, vi } from 'vitest';
import { createHttpReviewRepository } from './repository';

const response = (data: unknown) => new Response(JSON.stringify({ code: 'OK', data }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
});

describe('review repository', () => {
  it('shows the reviewer recorded by the claim history', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({
        id: '21', title: '待审视频', authorNickname: '作者', auditStatus: 'CLAIMED',
        publishStatus: 'UNPUBLISHED', riskLevel: 'LOW', currentVersion: 3,
        categories: [], tags: [], originalMedia: { url: '/media/review-21.mp4' }, createdAt: '2026-09-18T08:00:00Z'
      }))
      .mockResolvedValueOnce(response([{
        id: '9', videoVersion: 3, reviewerAdminId: '42', action: 'CLAIMED',
        createdAt: '2026-09-18T08:05:00Z'
      }]));

    const task = await createHttpReviewRepository('', fetcher).get('21');

    expect(task.claimedBy).toBe('管理员 42');
    expect(task.videoUrl).toBe('/media/review-21.mp4');
  });

  it('keeps the queue submittedAt instead of replacing it with creation time', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ page: 1, pageSize: 20, total: 1, items: [{ id: '21', authorId: '9', authorNickname: '作者', title: '重新提交', riskLevel: 'LOW', currentVersion: 2, submittedAt: '2026-09-22T08:00:00Z' }] }))
      .mockResolvedValueOnce(response({ id: '21', authorId: '9', authorNickname: '作者', title: '重新提交', auditStatus: 'PENDING_REVIEW', currentVersion: 2, createdAt: '2026-08-01T08:00:00Z', updatedAt: '2026-09-22T08:00:00Z', categories: [], tags: [] }))
      .mockResolvedValueOnce(response([]));

    const page = await createHttpReviewRepository('', fetcher).list({ page: 1, pageSize: 20 });

    expect(page.items[0].submittedAt).toBe('2026-09-22T08:00:00Z');
  });
});
