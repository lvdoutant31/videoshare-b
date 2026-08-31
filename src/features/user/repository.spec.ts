import { describe, expect, it, vi } from 'vitest';
import { createHttpUserRepository, UserRepositoryError } from './repository';

const ok = (data: unknown) => new Response(JSON.stringify({ code: 'OK', data }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
});

describe('user HTTP repository', () => {
  it('maps list and moderation commands to documented admin endpoints', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(ok({ items: [], page: 2, pageSize: 20, total: 0 })));
    const repository = createHttpUserRepository('https://api.example.com', fetcher);

    await repository.list({ page: 2, pageSize: 20, keyword: '陈 思', status: 'NORMAL' });
    await repository.get('user/a');
    await repository.mute('user/a', { reason: '违规评论', endsAt: '2026-09-01T08:00:00.000Z' });
    await repository.revokePenalty('user/a', 'penalty/1', { reason: '申诉成立' });
    await repository.unbindWeCom('user/a', { reason: '账号交接' });

    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.example.com/api/v1/admin/users?page=2&pageSize=20&keyword=%E9%99%88+%E6%80%9D&status=NORMAL', { credentials: 'include', headers: { Accept: 'application/json' } });
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.example.com/api/v1/admin/users/user%2Fa', { credentials: 'include', headers: { Accept: 'application/json' } });
    expect(fetcher).toHaveBeenNthCalledWith(3, 'https://api.example.com/api/v1/admin/users/user%2Fa/mute', {
      method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: '违规评论', endsAt: '2026-09-01T08:00:00.000Z' })
    });
    expect(fetcher).toHaveBeenNthCalledWith(4, 'https://api.example.com/api/v1/admin/users/user%2Fa/penalties/penalty%2F1/revoke', {
      method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: '申诉成立' })
    });
    expect(fetcher).toHaveBeenNthCalledWith(5, 'https://api.example.com/api/v1/admin/users/user%2Fa/wecom-binding/unbind', {
      method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: '账号交接' })
    });
  });

  it('requests a ban confirmation token from the admin API', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(ok({ confirmationToken: 'confirm-once', expiresAt: '2026-09-01T08:01:00.000Z' })));
    const repository = createHttpUserRepository('https://api.example.com', fetcher);

    await expect(repository.requestBanConfirmation('user/a')).resolves.toBe('confirm-once');
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/v1/admin/confirmations', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'USER_BAN', targetType: 'USER', targetId: 'user/a' })
    });
  });

  it('preserves backend errors and normalizes malformed or unreachable responses', async () => {
    const denied = createHttpUserRepository('', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'PERMISSION_DENIED', message: '无此权限', data: null, traceId: 'trace-user-001' }), { status: 403, headers: { 'Content-Type': 'application/json' } })));
    const malformed = createHttpUserRepository('', vi.fn().mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502, headers: { 'X-Trace-Id': 'trace-proxy-001' } })));
    const offline = createHttpUserRepository('', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(denied.get('10001')).rejects.toEqual(expect.objectContaining<Partial<UserRepositoryError>>({ code: 'PERMISSION_DENIED', traceId: 'trace-user-001', status: 403 }));
    await expect(malformed.list({ page: 1, pageSize: 20 })).rejects.toEqual(expect.objectContaining({ message: '服务返回格式异常', traceId: 'trace-proxy-001', status: 502 }));
    await expect(offline.list({ page: 1, pageSize: 20 })).rejects.toEqual(expect.objectContaining({ message: '无法连接用户管理服务' }));
  });
});
