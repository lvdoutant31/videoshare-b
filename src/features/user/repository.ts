import type { BanUserInput, ManagedUserDetail, ReasonInput, TemporaryPenaltyInput, UserPage, UserQuery, UserRepository } from './model';

interface ApiEnvelope<T> {
  code: string;
  message?: string;
  data: T;
  traceId?: string;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class UserRepositoryError extends Error {
  readonly code?: string;
  readonly traceId?: string;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(message: string, options: { code?: string; traceId?: string; status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = 'UserRepositoryError';
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
    throw new UserRepositoryError('无法连接用户管理服务', { cause });
  }

  const traceId = response.headers.get('X-Trace-Id') ?? undefined;
  let envelope: ApiEnvelope<T>;
  try {
    envelope = await response.json() as ApiEnvelope<T>;
  } catch (cause) {
    throw new UserRepositoryError('服务返回格式异常', { status: response.status, traceId, cause });
  }

  if (!envelope || typeof envelope !== 'object' || typeof envelope.code !== 'string') {
    throw new UserRepositoryError('服务返回格式异常', { status: response.status, traceId });
  }
  if (!response.ok || envelope.code !== 'OK') {
    throw new UserRepositoryError(envelope.message || '用户操作失败', {
      code: envelope.code,
      traceId: envelope.traceId ?? traceId,
      status: response.status
    });
  }
  return envelope.data;
}

function queryParams(query: UserQuery) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.status) params.set('status', query.status);
  return params;
}

export function createHttpUserRepository(
  baseUrl = '',
  fetcher: Fetcher = globalThis.fetch.bind(globalThis)
): UserRepository {
  const root = `${baseUrl}/api/v1/admin/users`;
  const path = (userId: string, suffix = '') => `${root}/${encodeURIComponent(userId)}${suffix}`;
  const json = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return {
    list: (query) => requestData<UserPage>(fetcher, `${root}?${queryParams(query)}`),
    get: (userId) => requestData<ManagedUserDetail>(fetcher, path(userId)),
    mute: (userId, input: TemporaryPenaltyInput) => requestData<ManagedUserDetail>(fetcher, path(userId, '/mute'), json(input)),
    suspend: (userId, input: TemporaryPenaltyInput) => requestData<ManagedUserDetail>(fetcher, path(userId, '/suspend'), json(input)),
    requestBanConfirmation: async (userId) => {
      const confirmation = await requestData<{ confirmationToken: string }>(
        fetcher,
        `${baseUrl}/api/v1/admin/confirmations`,
        json({ action: 'USER_BAN', targetType: 'USER', targetId: userId })
      );
      if (!confirmation?.confirmationToken) {
        throw new UserRepositoryError('服务返回格式异常');
      }
      return confirmation.confirmationToken;
    },
    ban: (userId, input: BanUserInput) => requestData<ManagedUserDetail>(fetcher, path(userId, '/ban'), json(input)),
    revokePenalty: (userId, penaltyId, input: ReasonInput) => requestData<ManagedUserDetail>(fetcher, path(userId, `/penalties/${encodeURIComponent(penaltyId)}/revoke`), json(input)),
    unbindWeCom: (userId, input: ReasonInput) => requestData<ManagedUserDetail>(fetcher, path(userId, '/wecom-binding/unbind'), json(input))
  };
}

export const userRepositoryKey = Symbol('user-repository');
