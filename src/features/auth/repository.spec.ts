import { describe, expect, it, vi } from 'vitest';
import { createAdminAuthRepository } from './repository';

const ok = (data: unknown) => new Response(JSON.stringify({ code: 'OK', data }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
});

describe('admin auth repository', () => {
  it('uses credentialed requests for login, session recovery, and logout', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(ok({ id: '9000001', username: 'local-admin', permissions: ['user:view'] }))
      .mockResolvedValueOnce(ok({ id: '9000001', username: 'local-admin', permissions: ['user:view'] }))
      .mockResolvedValueOnce(ok(null));
    const repository = createAdminAuthRepository('https://api.example.com', fetcher);

    await expect(repository.login('local-admin', 'local-admin-password')).resolves.toMatchObject({ id: '9000001' });
    await expect(repository.session()).resolves.toMatchObject({ username: 'local-admin' });
    await expect(repository.logout()).resolves.toBeNull();

    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.example.com/api/v1/admin/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'local-admin', password: 'local-admin-password' })
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.example.com/api/v1/admin/auth/session', {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    expect(fetcher).toHaveBeenNthCalledWith(3, 'https://api.example.com/api/v1/admin/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
  });

  it('surfaces the API login failure message', async () => {
    const repository = createAdminAuthRepository('', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'LOGIN_FAILED', message: '用户名或密码错误', data: null
    }), { status: 401, headers: { 'Content-Type': 'application/json' }})));

    await expect(repository.login('wrong', 'wrong')).rejects.toThrow('用户名或密码错误');
  });
});
