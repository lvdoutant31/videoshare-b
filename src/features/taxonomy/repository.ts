import type {
  Category,
  CategoryInput,
  PageQuery,
  PageResult,
  Tag,
  TagInput,
  TaxonomyRepository
} from './model';

interface ApiEnvelope<T> {
  code: string;
  message?: string;
  data: T;
  traceId?: string;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class TaxonomyError extends Error {
  readonly code?: string;
  readonly traceId?: string;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(message: string, options: { code?: string; traceId?: string; status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = 'TaxonomyError';
    this.code = options.code;
    this.traceId = options.traceId;
    this.status = options.status;
    this.cause = options.cause;
  }
}

async function requestData<T>(fetcher: Fetcher, url: string, init?: RequestInit): Promise<T> {
  const { headers, ...request } = init ?? {};
  let response: Response;
  try {
    response = await fetcher(url, {
      credentials: 'include',
      ...request,
      headers: { Accept: 'application/json', ...headers }
    });
  } catch (cause) {
    throw new TaxonomyError('无法连接分类标签服务', { cause });
  }

  const traceId = response.headers.get('X-Trace-Id') ?? undefined;
  let envelope: ApiEnvelope<T>;
  try {
    envelope = await response.json() as ApiEnvelope<T>;
  } catch (cause) {
    throw new TaxonomyError('服务返回格式异常', { status: response.status, traceId, cause });
  }

  if (!envelope || typeof envelope !== 'object' || typeof envelope.code !== 'string') {
    throw new TaxonomyError('服务返回格式异常', { status: response.status, traceId });
  }
  if (!response.ok || envelope.code !== 'OK') {
    throw new TaxonomyError(envelope.message || '分类标签数据加载失败', {
      code: envelope.code,
      traceId: envelope.traceId ?? traceId,
      status: response.status
    });
  }
  return envelope.data;
}

function pageParams(query: PageQuery) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.status) params.set('status', query.status);
  return params;
}

export function createHttpTaxonomyRepository(
  baseUrl = '',
  fetcher: Fetcher = globalThis.fetch.bind(globalThis)
): TaxonomyRepository {
  const endpoint = (resource: 'categories' | 'tags', suffix = '') => `${baseUrl}/api/v1/admin/${resource}${suffix}`;
  const json = (method: 'POST' | 'PATCH', body: unknown): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return {
    listCategories: (query) => requestData<PageResult<Category>>(fetcher, `${endpoint('categories')}?${pageParams(query)}`),
    createCategory: (input) => requestData<Category>(fetcher, endpoint('categories'), json('POST', input)),
    updateCategory: (id, input) => requestData<Category>(fetcher, endpoint('categories', `/${id}`), json('PATCH', input)),
    async deleteCategory(id) { await requestData<null>(fetcher, endpoint('categories', `/${id}`), { method: 'DELETE' }); },
    listTags: (query) => requestData<PageResult<Tag>>(fetcher, `${endpoint('tags')}?${pageParams(query)}`),
    createTag: (input) => requestData<Tag>(fetcher, endpoint('tags'), json('POST', input)),
    updateTag: (id, input) => requestData<Tag>(fetcher, endpoint('tags', `/${id}`), json('PATCH', input)),
    async deleteTag(id) { await requestData<null>(fetcher, endpoint('tags', `/${id}`), { method: 'DELETE' }); }
  };
}

export const taxonomyRepositoryKey = Symbol('taxonomy-repository');
