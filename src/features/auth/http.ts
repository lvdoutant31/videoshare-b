/**
 * 管理端会话相关的 HTTP 基础设施。
 *
 * 把两件事收口在这里，避免各业务模块各写一遍：
 * 1. 统一响应体解析与稳定错误码（{@link ApiError}），调用方按 code 判断而不解析文案；
 * 2. 会话失效（HTTP 401）的全局识别与跳转登录页。
 *
 * 这里不直接依赖路由与登录态：跳转动作由 main.ts 通过 {@link setUnauthorizedHandler} 注册，
 * 避免 http → router → repository → http 的循环依赖（与 C 端 setAuthRequiredHandler 的约定一致）。
 */

export interface ApiEnvelope<T> {
  code: string;
  message?: string;
  data: T;
  traceId?: string;
}

export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** 后端 AuthExceptionAdvice 保证：会话不可用时返回下列错误码之一。 */
export const SESSION_INVALID_CODES: ReadonlySet<string> = new Set(['AUTH_REQUIRED', 'TOKEN_EXPIRED', 'UNAUTHORIZED']);

/** 携带稳定错误码的请求失败。403（权限不足）与 401（会话失效）语义不同，调用方必须区分。 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly traceId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 是否为"会话失效"（需要跳转登录页），而非权限不足或普通业务失败。 */
export function isSessionInvalid(cause: unknown): boolean {
  return cause instanceof ApiError
    && (cause.httpStatus === 401 || SESSION_INVALID_CODES.has(cause.code));
}

/**
 * 清洗回跳地址，只允许站内绝对路径。
 *
 * 拒绝 `//evil.example.com`（协议相对地址）、`http://…`、`/\evil.example.com` 等写法，
 * 避免 `?redirect=` 参数造成开放重定向。
 */
export function sanitizeRedirect(raw: unknown, fallback = '/dashboard'): string {
  const value = typeof raw === 'string' ? raw : '';
  return /^\/(?![/\\])[^\s\\]*$/.test(value) ? value : fallback;
}

let unauthorizedHandler: (() => void) | null = null;

/** 注册会话失效处理：清空登录态并跳转登录页。传 null 取消注册（测试用）。 */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

/**
 * 解析统一响应体；失败时抛出携带稳定错误码的 {@link ApiError}。
 *
 * @param redirectOnUnauthorized 会话失效时是否触发全局跳转。登录与会话探测接口应传 false：
 *   登录失败本身不是"会话过期"，会话探测的导航由路由守卫负责。
 */
export async function readEnvelope<T>(
  response: Response,
  options: { redirectOnUnauthorized?: boolean } = {},
): Promise<T> {
  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // 网关错误页等非 JSON 响应：按 HTTP 状态判定
  }

  const code = body?.code ?? 'HTTP_ERROR';
  if (options.redirectOnUnauthorized !== false && (response.status === 401 || SESSION_INVALID_CODES.has(code))) {
    unauthorizedHandler?.();
  }
  if (!response.ok || body === null || code !== 'OK') {
    throw new ApiError(code, body?.message ?? `请求失败（HTTP ${response.status}）`, response.status, body?.traceId);
  }
  return body.data;
}

/**
 * 包装 fetch 供各业务 repository 使用：附加 Cookie 凭证，并在会话失效时触发全局跳转。
 *
 * 凭证与失效处理在此统一收口，因此各 repository 只关心自己的 URL 与字段映射，
 * 新增 repository 时不会遗漏会话处理。
 */
export function createAuthenticatedFetch(fetcher: Fetcher = globalThis.fetch.bind(globalThis)): Fetcher {
  return async (input, init) => {
    const response = await fetcher(input, { credentials: 'include', ...init });
    // 只按状态码判定：读取响应体会消费流，使调用方无法再解析。
    if (response.status === 401) {
      unauthorizedHandler?.();
    }
    return response;
  };
}
