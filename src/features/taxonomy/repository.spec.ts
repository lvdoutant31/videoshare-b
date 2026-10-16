import { describe, expect, it, vi } from 'vitest';
import { createHttpTaxonomyRepository, TaxonomyError } from './repository';

const ok = (data: unknown) => new Response(JSON.stringify({ code: 'OK', data }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
});

describe('taxonomy HTTP repository', () => {
  it('maps list filters to the real admin endpoints', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(ok({ items: [], page: 2, pageSize: 20, total: 0 })));
    const repository = createHttpTaxonomyRepository('', fetcher);

    await repository.listCategories({ page: 2, pageSize: 20, keyword: '安全', status: 'ENABLED' });
    await repository.listTags({ page: 1, pageSize: 10 });

    expect(fetcher).toHaveBeenNthCalledWith(1,
      '/api/v1/admin/categories?page=2&pageSize=20&keyword=%E5%AE%89%E5%85%A8&status=ENABLED',
      { credentials: 'include', headers: { Accept: 'application/json' } });
    expect(fetcher).toHaveBeenNthCalledWith(2,
      '/api/v1/admin/tags?page=1&pageSize=10',
      { credentials: 'include', headers: { Accept: 'application/json' } });
  });

  it('maps create, update and delete to JSON CRUD requests', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(ok({})));
    const repository = createHttpTaxonomyRepository('https://api.example.com', fetcher);

    await repository.createCategory({ name: '安全', icon: null, sort: 10, status: 'ENABLED' });
    await repository.updateTag('9', { status: 'DISABLED' });
    await repository.deleteCategory('8');

    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.example.com/api/v1/admin/categories', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '安全', icon: null, sort: 10, status: 'ENABLED' })
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.example.com/api/v1/admin/tags/9', {
      method: 'PATCH',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DISABLED' })
    });
    expect(fetcher).toHaveBeenNthCalledWith(3, 'https://api.example.com/api/v1/admin/categories/8', {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
  });

  it('preserves backend error details', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'RESOURCE_CONFLICT',
      message: '名称已存在',
      data: null,
      traceId: 'trace-taxonomy-001'
    }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
    const repository = createHttpTaxonomyRepository('', fetcher);

    await expect(repository.createTag({ name: '安全', heatScore: 0, status: 'ENABLED' }))
      .rejects.toEqual(expect.objectContaining<Partial<TaxonomyError>>({
        name: 'TaxonomyError',
        message: '名称已存在',
        code: 'RESOURCE_CONFLICT',
        traceId: 'trace-taxonomy-001',
        status: 409
      }));
  });

  it('turns malformed and unreachable responses into stable messages', async () => {
    const malformed = createHttpTaxonomyRepository('', vi.fn().mockResolvedValue(
      new Response('<html>bad gateway</html>', { status: 502, headers: { 'X-Trace-Id': 'trace-proxy-001' } })
    ));
    const offline = createHttpTaxonomyRepository('', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(malformed.listTags({ page: 1, pageSize: 20 })).rejects.toEqual(
      expect.objectContaining({ message: '服务返回格式异常', traceId: 'trace-proxy-001', status: 502 })
    );
    await expect(offline.listCategories({ page: 1, pageSize: 20 })).rejects.toEqual(
      expect.objectContaining({ message: '无法连接分类标签服务' })
    );
  });
});
