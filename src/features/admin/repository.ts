import type { AdminRepository, AdminRole, AdminStatus, AdminUserDetail, AdminUserPage, AdminUserQuery, CreateAdminInput } from './model';

interface ApiEnvelope<T> { code: string; message?: string; data: T; traceId?: string; }
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class AdminRepositoryError extends Error {
  readonly code?: string;
  readonly traceId?: string;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(message: string, options: { code?: string; traceId?: string; status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = 'AdminRepositoryError';
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
    response = await fetcher(url, { ...request, credentials: 'include', headers: { Accept: 'application/json', ...headers } });
  } catch (cause) {
    throw new AdminRepositoryError('无法连接管理员管理服务', { cause });
  }
  const traceId = response.headers.get('X-Trace-Id') ?? undefined;
  let envelope: ApiEnvelope<T>;
  try { envelope = await response.json() as ApiEnvelope<T>; }
  catch (cause) { throw new AdminRepositoryError('服务返回格式异常', { status: response.status, traceId, cause }); }
  if (!envelope || typeof envelope !== 'object' || typeof envelope.code !== 'string') {
    throw new AdminRepositoryError('服务返回格式异常', { status: response.status, traceId });
  }
  if (!response.ok || envelope.code !== 'OK') {
    throw new AdminRepositoryError(envelope.message || '管理员操作失败', { code: envelope.code, traceId: envelope.traceId ?? traceId, status: response.status });
  }
  return envelope.data;
}

function params(query: AdminUserQuery) {
  const value = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.keyword) value.set('keyword', query.keyword);
  if (query.status) value.set('status', query.status);
  return value;
}

export function createHttpAdminRepository(baseUrl = '', fetcher: Fetcher = globalThis.fetch.bind(globalThis)): AdminRepository {
  const root = `${baseUrl}/api/v1/admin/admins`;
  const path = (id: string, suffix = '') => `${root}/${encodeURIComponent(id)}${suffix}`;
  const json = (method: 'POST' | 'PATCH', body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return {
    list: (query) => requestData<AdminUserPage>(fetcher, `${root}?${params(query)}`),
    get: (id) => requestData<AdminUserDetail>(fetcher, path(id)),
    create: (input: CreateAdminInput) => requestData<AdminUserDetail>(fetcher, root, json('POST', input)),
    updateRoles: (id, roleCodes) => requestData<AdminUserDetail>(fetcher, path(id, '/roles'), json('PATCH', { roleCodes })),
    async resetPassword(id, newPassword) { await requestData<null>(fetcher, path(id, '/password'), json('POST', { newPassword })); },
    updateStatus: (id, status: AdminStatus) => requestData<AdminUserDetail>(fetcher, path(id, '/status'), json('PATCH', { status })),
    listRoles: () => requestData<AdminRole[]>(fetcher, `${root}/roles`)
  };
}

export const adminRepositoryKey = Symbol('admin-repository');
