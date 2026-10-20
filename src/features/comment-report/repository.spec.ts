import { describe, expect, it, vi } from 'vitest';
import { createHttpCommentReportRepository, CommentReportRepositoryError } from './repository';

const response = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', ...init.headers }, ...init });

describe('comment report HTTP repository', () => {
  it('uses documented comment paths and encodes IDs', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response({ code: 'OK', data: { id: 'comment/a' } })));
    const repository = createHttpCommentReportRepository('https://api.example.com', fetcher);

    await repository.getComment('comment/a');
    await repository.hideComment('comment/a', '违规营销');
    await repository.restoreComment('comment/a');
    await repository.deleteComment('comment/a', '严重违规');

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.com/api/v1/admin/comments/comment%2Fa',
      'https://api.example.com/api/v1/admin/comments/comment%2Fa/hide',
      'https://api.example.com/api/v1/admin/comments/comment%2Fa/restore',
      'https://api.example.com/api/v1/admin/comments/comment%2Fa'
    ]);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ reason: '违规营销' }) });
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: 'POST' });
    expect(fetcher.mock.calls[3][1]).toMatchObject({ method: 'DELETE', body: JSON.stringify({ reason: '严重违规' }) });
  });

  it('uses only defined pagination parameters for list requests', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response({ code: 'OK', data: { items: [], page: 1, pageSize: 20, total: 0 } })));
    const repository = createHttpCommentReportRepository('', fetcher);

    await repository.listComments({ page: 1, pageSize: 20, keyword: '广告', status: 'HIDDEN' });
    await repository.listReports({ page: 2, pageSize: 10, status: 'PROCESSING', targetType: 'COMMENT', riskLevel: 'HIGH' });

    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/admin/comments?page=1&pageSize=20&status=HIDDEN');
    expect(fetcher.mock.calls[1][0]).toBe('/api/v1/admin/reports?page=2&pageSize=10&status=PROCESSING&targetType=COMMENT&riskLevel=HIGH');
  });

  it('defaults missing comment detail collections to empty arrays', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ code: 'OK', data: { id: 1, content: '测试评论' } }));
    const repository = createHttpCommentReportRepository('', fetcher);

    await expect(repository.getComment('1')).resolves.toMatchObject({ id: '1', replies: [], history: [] });
  });

  it('sends moderation actions to the backend', async () => {
    const fetcher = vi.fn().mockImplementation(() => response({ code: 'OK', data: {} }));
    const repository = createHttpCommentReportRepository('', fetcher);

    await repository.batchHandleComments(['comment-1'], 'HIDDEN', '违规');
    await repository.claimReport('report-1');
    await repository.resolveReport('report-1', '已处理');
    await repository.rejectReport('report-1', '证据不足');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/admin/comments/batch',
      '/api/v1/admin/reports/report-1/claim',
      '/api/v1/admin/reports/report-1/resolve',
      '/api/v1/admin/reports/report-1/reject'
    ]);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ ids: ['comment-1'], status: 'HIDDEN', reason: '违规' }) });
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ resolution: 'RESOLVED', note: '已处理' }) });
    expect(fetcher.mock.calls[3][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ note: '证据不足' }) });
  });

  it('preserves assignee IDs and handles report details without a history collection', async () => {
    const repository = createHttpCommentReportRepository('', vi.fn().mockResolvedValue(response({ code: 'OK', data: { id: 1, assigneeAdminId: 7, targetSummary: '被举报内容' } })));
    await expect(repository.getReport('1')).resolves.toMatchObject({ id: '1', assigneeAdminId: '7', targetSummary: '被举报内容', history: [] });
  });

  it('retains backend trace details and normalizes malformed responses', async () => {
    const rejected = createHttpCommentReportRepository('', vi.fn().mockResolvedValue(response({ code: 'PERMISSION_DENIED', message: '无权限', traceId: 'trace-1', data: null }, { status: 403 })));
    await expect(rejected.getReport('report-1')).rejects.toMatchObject({ code: 'PERMISSION_DENIED', traceId: 'trace-1', status: 403 });

    const malformed = createHttpCommentReportRepository('', vi.fn().mockResolvedValue(new Response('bad', { status: 500, headers: { 'X-Trace-Id': 'trace-2' } })));
    await expect(malformed.getComment('comment-1')).rejects.toBeInstanceOf(CommentReportRepositoryError);
    await expect(malformed.getComment('comment-1')).rejects.toMatchObject({ traceId: 'trace-2', status: 500 });
  });
});
