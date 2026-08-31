import { reactive } from 'vue';

export interface AdminSession {
  id: string;
  username: string;
  permissions: string[];
}

interface ApiEnvelope<T> { code: string; message?: string; data: T; }
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function request<T>(fetcher: Fetcher, url: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, {
    credentials: 'include',
    ...init,
    headers: { Accept: 'application/json', ...init?.headers }
  });
  const body = await response.json() as ApiEnvelope<T>;
  if (!response.ok || body.code !== 'OK') throw new Error(body.message || '认证服务请求失败');
  return body.data;
}

export function createAdminAuthRepository(baseUrl = '', fetcher: Fetcher = globalThis.fetch.bind(globalThis)) {
  const root = `${baseUrl}/api/v1/admin/auth`;
  return {
    session: () => request<AdminSession>(fetcher, `${root}/session`),
    login: (username: string, password: string) => request<AdminSession>(fetcher, `${root}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
    }),
    logout: () => request<void>(fetcher, `${root}/logout`, { method: 'POST' })
  };
}

export const authState = reactive<{ loading: boolean; session: AdminSession | null; error: string | null }>({
  loading: true, session: null, error: null
});
