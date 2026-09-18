import { describe, expect, it, vi } from 'vitest';
import { createHttpVideoRepository } from './repository';
import { allowedActions, type VideoStatus } from './model';

function response(data: unknown) {
  return new Response(JSON.stringify({ code: 'OK', data }), { headers: { 'Content-Type': 'application/json' } });
}

describe('video review and publication state', () => {
  it.each([
    ['APPROVED', 'UNPUBLISHED', 'APPROVED', false],
    ['DRAFT', 'UNPUBLISHED', 'DRAFT', true],
    ['REJECTED', 'UNPUBLISHED', 'REJECTED', true],
    ['REVISION_REQUIRED', 'UNPUBLISHED', 'REVISION_REQUIRED', true],
    ['PENDING_REVIEW', 'UNPUBLISHED', 'PENDING_REVIEW', false],
    ['APPROVED', 'PUBLISHED', 'PUBLISHED', false],
    ['APPROVED', 'OFF_SHELF', 'OFF_SHELF', false],
  ])('maps %s / %s to %s with the correct review action', async (auditStatus, publishStatus, expected, canSubmit) => {
    const repo = createHttpVideoRepository('', vi.fn().mockResolvedValue(response({ id: '1', auditStatus, publishStatus })));
    const video = await repo.get('1');
    expect(video.status).toBe(expected);
    expect(allowedActions[video.status].includes('submitReview')).toBe(canSubmit);
  });

  it('offers publish only for approved unpublished videos', async () => {
    const repo = createHttpVideoRepository('', vi.fn().mockResolvedValue(response({ id: '1', auditStatus: 'APPROVED', publishStatus: 'UNPUBLISHED' })));
    const video = await repo.get('1');
    expect(allowedActions[video.status]).toContain('publish');
  });

  it('filters pending publication by approval and publication status together', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({items: [], total: 0, page: 1, pageSize: 20}));
    await createHttpVideoRepository('', fetcher).list({ page: 1, pageSize: 20, status: 'APPROVED' as VideoStatus });
    const url = new URL(fetcher.mock.calls[0][0], 'http://localhost');
    expect(url.searchParams.get('auditStatus')).toBe('APPROVED');
    expect(url.searchParams.get('publishStatus')).toBe('UNPUBLISHED');
  });
});
