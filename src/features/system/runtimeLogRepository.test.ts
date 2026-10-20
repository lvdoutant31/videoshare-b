import { describe, expect, it, vi } from 'vitest';
import { createHttpRuntimeLogRepository } from './runtimeLogRepository';

describe('createHttpRuntimeLogRepository', () => {
  it('requests a bounded tail with the authenticated session', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      code: 'OK', data: { available: true, sizeBytes: 24, modifiedAt: null, truncated: false, lines: ['INFO 中文日志'] },
    }), { status: 200 }));

    const result = await createHttpRuntimeLogRepository('/videoshare', fetcher).tail(120);

    expect(fetcher).toHaveBeenCalledWith('/videoshare/api/v1/admin/runtime-logs?lines=120', expect.objectContaining({
      credentials: 'include',
    }));
    expect(result.lines).toEqual(['INFO 中文日志']);
  });
});
