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
        categories: [], tags: [], createdAt: '2026-09-18T08:00:00Z'
      }))
      .mockResolvedValueOnce(response([{
        id: '9', videoVersion: 3, reviewerAdminId: '42', action: 'CLAIMED',
        createdAt: '2026-09-18T08:05:00Z'
      }]));

    const task = await createHttpReviewRepository('', fetcher).get('21');

    expect(task.claimedBy).toBe('管理员 42');
  });
});
