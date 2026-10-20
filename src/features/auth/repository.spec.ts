import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEncryptedFetch } from '../../api/crypto';
import { createAdminAuthRepository } from './repository';

const { secureFetch } = vi.hoisted(() => ({ secureFetch: vi.fn() }));
vi.mock('../../api/crypto', () => ({ createEncryptedFetch: vi.fn(() => secureFetch) }));

const ok = (data: unknown) => new Response(JSON.stringify({ code: 'OK', data }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

describe('admin auth repository', () => {
  beforeEach(() => {
    secureFetch.mockReset();
    vi.mocked(createEncryptedFetch).mockClear();
  });

  it('uses the encrypted transport with the videoshare context by default', async () => {
    secureFetch.mockResolvedValueOnce(ok({ id: '9000001', username: 'local-admin', permissions: [] }));
    const fetcher = vi.fn();
    const repository = createAdminAuthRepository(undefined, fetcher);

    await repository.login('local-admin', 'local-admin-password');

    expect(createEncryptedFetch).toHaveBeenCalledWith('/videoshare', fetcher);
    expect(secureFetch).toHaveBeenCalledWith('/videoshare/api/v1/admin/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'local-admin', password: 'local-admin-password' }),
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('routes login, session recovery, and logout through encrypted fetch', async () => {
    secureFetch
      .mockResolvedValueOnce(ok({ id: '9000001', username: 'local-admin', permissions: ['user:view'] }))
      .mockResolvedValueOnce(ok({ id: '9000001', username: 'local-admin', permissions: ['user:view'] }))
      .mockResolvedValueOnce(ok(null));
    const repository = createAdminAuthRepository('https://api.example.com', vi.fn());

    await expect(repository.login('local-admin', 'local-admin-password')).resolves.toMatchObject({ id: '9000001' });
    await expect(repository.session()).resolves.toMatchObject({ username: 'local-admin' });
    await expect(repository.logout()).resolves.toBeNull();

    expect(secureFetch).toHaveBeenNthCalledWith(2, 'https://api.example.com/api/v1/admin/auth/session', {
      credentials: 'include', headers: { Accept: 'application/json' },
    });
    expect(secureFetch).toHaveBeenNthCalledWith(3, 'https://api.example.com/api/v1/admin/auth/logout', {
      method: 'POST', credentials: 'include', headers: { Accept: 'application/json' },
    });
  });

  it('surfaces the API login failure message', async () => {
    secureFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      code: 'LOGIN_FAILED', message: '用户名或密码错误', data: null,
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
    const repository = createAdminAuthRepository('', vi.fn());

    await expect(repository.login('wrong', 'wrong')).rejects.toThrow('用户名或密码错误');
  });
});
