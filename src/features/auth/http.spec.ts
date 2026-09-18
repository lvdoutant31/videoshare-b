import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  createAuthenticatedFetch,
  isSessionInvalid,
  sanitizeRedirect,
  setUnauthorizedHandler,
} from './http';

describe('sanitizeRedirect', () => {
  it('keeps in-app absolute paths including query and hash', () => {
    expect(sanitizeRedirect('/videos?page=2&keyword=科技')).toBe('/videos?page=2&keyword=科技');
    expect(sanitizeRedirect('/system/operation-logs')).toBe('/system/operation-logs');
  });

  it('rejects protocol-relative and absolute targets to prevent open redirect', () => {
    expect(sanitizeRedirect('//evil.example.com/admin')).toBe('/dashboard');
    expect(sanitizeRedirect('http://evil.example.com')).toBe('/dashboard');
    expect(sanitizeRedirect('https://evil.example.com')).toBe('/dashboard');
    expect(sanitizeRedirect('/\\evil.example.com')).toBe('/dashboard');
    expect(sanitizeRedirect('dashboard')).toBe('/dashboard');
    expect(sanitizeRedirect(undefined)).toBe('/dashboard');
    expect(sanitizeRedirect(['/videos'])).toBe('/dashboard');
  });

  it('honours a custom fallback', () => {
    expect(sanitizeRedirect('//evil.example.com', '/login')).toBe('/login');
  });
});

describe('createAuthenticatedFetch', () => {
  afterEach(() => setUnauthorizedHandler(null));

  it('sends credentials and reports session invalidation on 401', async () => {
    const onInvalid = vi.fn();
    setUnauthorizedHandler(onInvalid);
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));

    await createAuthenticatedFetch(fetcher)('/api/v1/admin/videos');

    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/videos', { credentials: 'include' });
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });

  it('preserves caller init options', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await createAuthenticatedFetch(fetcher)('/api/v1/admin/videos', { method: 'PATCH' });

    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/videos', { credentials: 'include', method: 'PATCH' });
  });

  it('leaves permission and business failures to the caller', async () => {
    const onInvalid = vi.fn();
    setUnauthorizedHandler(onInvalid);
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));

    await createAuthenticatedFetch(fetcher)('/api/v1/admin/videos');

    expect(onInvalid).not.toHaveBeenCalled();
  });
});

describe('isSessionInvalid', () => {
  it('separates session failure from permission failure', () => {
    expect(isSessionInvalid(new ApiError('TOKEN_EXPIRED', '登录已过期', 401))).toBe(true);
    expect(isSessionInvalid(new ApiError('AUTH_REQUIRED', '请先登录', 401))).toBe(true);
    // 403 表示已登录但无权限：不能把用户踢回登录页
    expect(isSessionInvalid(new ApiError('PERMISSION_DENIED', '无权执行此操作', 403))).toBe(false);
    expect(isSessionInvalid(new ApiError('ACCOUNT_LOCKED', '已锁定', 423))).toBe(false);
    expect(isSessionInvalid(new Error('网络异常'))).toBe(false);
  });
});
