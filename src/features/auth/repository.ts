import { reactive } from 'vue';
import { readEnvelope, type Fetcher } from './http';

export interface AdminSession {
  id: string;
  username: string;
  permissions: string[];
  /** 后端随会话返回的角色码，用于界面展示与排查；不影响鉴权判断。 */
  roles?: string[];
  /** 会话剩余有效期（秒）；null 表示不适用（本地调试旁路无真实会话）。 */
  expiresIn?: number | null;
}

async function request<T>(fetcher: Fetcher, url: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, {
    credentials: 'include',
    ...init,
    headers: { Accept: 'application/json', ...init?.headers }
  });
  // 登录失败与"会话已过期"是两回事，且两者都不该由本模块触发跳转：
  // 登录页负责展示失败原因，会话探测的导航由路由守卫决定。
  return readEnvelope<T>(response, { redirectOnUnauthorized: false });
}

export function createAdminAuthRepository(baseUrl = '/videoshare', fetcher: Fetcher = globalThis.fetch.bind(globalThis)) {
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
