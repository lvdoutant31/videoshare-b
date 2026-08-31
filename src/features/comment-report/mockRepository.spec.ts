import { describe, expect, it } from 'vitest';
import { createMockCommentReportRepository } from './mockRepository';

describe('mock comment report repository', () => {
  it('filters comments and validates moderation transitions', async () => {
    const repository = createMockCommentReportRepository();
    const page = await repository.listComments({ page: 1, pageSize: 20, status: 'HIDDEN' });
    expect(page.items.map((item) => item.id)).toEqual(['comment-104']);

    await expect(repository.hideComment('comment-101', '')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    const hidden = await repository.hideComment('comment-101', '违规内容');
    expect(hidden.status).toBe('HIDDEN');
    const restored = await repository.restoreComment('comment-101');
    expect(restored.status).toBe('NORMAL');
    await expect(repository.restoreComment('comment-101')).rejects.toMatchObject({ code: 'STATE_CONFLICT' });
  });

  it('applies the backend batch status contract', async () => {
    const repository = createMockCommentReportRepository();
    await repository.batchHandleComments(['comment-101'], 'HIDDEN', '批量处置');
    expect((await repository.getComment('comment-101')).status).toBe('HIDDEN');
  });

  it('requires claiming reports before resolution', async () => {
    const repository = createMockCommentReportRepository();
    await expect(repository.resolveReport('report-201', '已核查')).rejects.toMatchObject({ code: 'REPORT_NOT_CLAIMED_BY_CURRENT_OPERATOR' });
    const claimed = await repository.claimReport('report-201');
    expect(claimed.status).toBe('PROCESSING');
    const resolved = await repository.resolveReport('report-201', '已核查并记录处理结论');
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.history[0].action).toBe('解决');
  });

  it('requires a reason when rejecting reports', async () => {
    const repository = createMockCommentReportRepository();
    await expect(repository.rejectReport('report-202', ' ')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    const rejected = await repository.rejectReport('report-202', '证据不足');
    expect(rejected.status).toBe('REJECTED');
  });
});
