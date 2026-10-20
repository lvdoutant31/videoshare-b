import { ApiError } from '../features/auth/http';

const API_PREFIX = '/api/v1';
const ADMIN_PREFIX = `${API_PREFIX}/admin/`;
const ENCRYPTED_CONTENT_TYPE = 'application/vnd.yingliu.encrypted+json';
const ENCRYPTED_HEADER = 'X-Yingliu-Encrypted';
const ENVELOPE_HEADER = 'X-Yingliu-Envelope';
const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface EncryptedRequestOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  authorization?: string;
  signal?: AbortSignal;
}

interface PublicKeyData {
  v: '1';
  kid: string;
  alg: 'RSA-OAEP-256';
  enc: 'A256GCM';
  format: 'spki';
  publicKey: string;
  expiresAt: number;
}

interface EncryptedEnvelope {
  v: '1';
  kid: string;
  alg: 'RSA-OAEP-256';
  enc: 'A256GCM';
  requestId: string;
  timestamp: number;
  encryptedKey: string;
  iv: string;
  ciphertext: string;
}

interface EncryptedResponse {
  v: '1';
  kid: string;
  enc: 'A256GCM';
  requestId: string;
  timestamp: number;
  iv: string;
  ciphertext: string;
}

interface KeyMaterial { info: PublicKeyData; key: CryptoKey }

interface Exchange {
  keyInfo: PublicKeyData;
  aesKey: CryptoKey;
  requestId: string;
  timestamp: number;
  aad: Uint8Array;
  envelope: EncryptedEnvelope;
}

/** B 端透明加密传输；JSON 与无请求体接口加密，文件上传 FormData 原样旁路。 */
export function createEncryptedFetch(
  baseUrl = DEFAULT_BASE_URL,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): typeof fetch {
  let cachedKey: KeyMaterial | undefined;
  let loadingKey: Promise<KeyMaterial> | undefined;

  const getKey = async (signal?: AbortSignal) => {
    if (cachedKey && cachedKey.info.expiresAt > Date.now() + 5_000) return cachedKey;
    loadingKey ??= loadKey(fetcher, baseUrl, signal);
    try {
      cachedKey = await loadingKey;
      return cachedKey;
    } finally {
      loadingKey = undefined;
    }
  };

  const dispatch = async (
    input: RequestInfo | URL,
    init: RequestInit = {},
    mayRefreshKey = true,
  ): Promise<Response> => {
    const source = input instanceof Request ? input : undefined;
    const headers = new Headers(source?.headers);
    new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    const path = protocolPath(input);
    const contentType = headers.get('Content-Type') ?? '';
    const body = init.body;

    if (!path?.startsWith(ADMIN_PREFIX)
        || body instanceof FormData
        || contentType.toLowerCase().startsWith('multipart/form-data')) {
      return fetcher(input, init);
    }

    const method = (init.method ?? source?.method ?? 'GET').toUpperCase();
    const authorization = headers.get('Authorization') ?? '';
    const signal = init.signal ?? source?.signal;
    const plaintext = await requestJson(source, body);
    const exchange = await encryptExchange(await getKey(signal), method, path, {
      body: plaintext,
      query: requestQuery(input),
    }, authorization);
    headers.set(ENCRYPTED_HEADER, '1');
    headers.delete('Content-Length');

    let encryptedBody: BodyInit | null = null;
    if (body == null && !source?.body) {
      headers.set(ENVELOPE_HEADER, b64(encoder.encode(JSON.stringify(exchange.envelope))));
      headers.delete('Content-Type');
    } else {
      headers.delete(ENVELOPE_HEADER);
      headers.set('Content-Type', ENCRYPTED_CONTENT_TYPE);
      encryptedBody = JSON.stringify(exchange.envelope);
    }

    const response = await fetcher(withoutQuery(input), { ...init, method, headers, body: encryptedBody });
    if (!response.headers.get('Content-Type')?.toLowerCase().startsWith(ENCRYPTED_CONTENT_TYPE)) {
      if (mayRefreshKey && await isRejectedCryptoKey(response)) {
        if (cachedKey?.info.kid === exchange.keyInfo.kid) cachedKey = undefined;
        return dispatch(input, init, false);
      }
      return response;
    }
    return decryptFetchResponse(response, exchange);
  };

  return dispatch as typeof fetch;
}

/** 保留单接口调用契约，供独立加密端点和协议测试使用。 */
export async function encryptedRequest<T>(
  path: string,
  body: unknown,
  options: EncryptedRequestOptions = {},
): Promise<T> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const authorization = options.authorization ?? '';
  const requestPath = `${API_PREFIX}${path}`;
  const exchange = await encryptExchange(
    await loadKey(fetcher, baseUrl, options.signal), 'POST', requestPath, body, authorization,
  );
  const response = await fetcher(`${baseUrl}${requestPath}`, {
    method: 'POST',
    credentials: 'include',
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': ENCRYPTED_CONTENT_TYPE,
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(exchange.envelope),
  });
  if (!response.ok) throw await responseError(response);
  return decryptPayload<T>(await response.json() as EncryptedResponse, exchange);
}

async function loadKey(fetcher: typeof fetch, baseUrl: string, signal?: AbortSignal): Promise<KeyMaterial> {
  const info = await fetchPublicKey(fetcher, baseUrl, signal);
  const key = await crypto.subtle.importKey(
    'spki', bytes(info.publicKey), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'],
  );
  return { info, key };
}

async function encryptExchange(
  material: KeyMaterial,
  method: string,
  path: string,
  body: unknown,
  authorization: string,
): Promise<Exchange> {
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const requestId = crypto.randomUUID();
  const timestamp = Date.now();
  const aad = await makeAad(method, path, material.info.kid, timestamp, requestId, authorization);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, aesKey, encoder.encode(JSON.stringify(body)),
  );
  const rawKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, material.key, rawKey);
  const envelope: EncryptedEnvelope = {
    v: '1', kid: material.info.kid, alg: material.info.alg, enc: material.info.enc, requestId, timestamp,
    encryptedKey: b64(encryptedKey), iv: b64(iv), ciphertext: b64(ciphertext),
  };
  return { keyInfo: material.info, aesKey, requestId, timestamp, aad, envelope };
}

async function decryptFetchResponse(response: Response, exchange: Exchange): Promise<Response> {
  const envelope = await response.json() as EncryptedResponse;
  const plaintext = await decryptBytes(envelope, exchange);
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'application/json');
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  return new Response(plaintext, { status: response.status, statusText: response.statusText, headers });
}

async function decryptPayload<T>(envelope: EncryptedResponse, exchange: Exchange): Promise<T> {
  return JSON.parse(decoder.decode(await decryptBytes(envelope, exchange))) as T;
}

async function decryptBytes(envelope: EncryptedResponse, exchange: Exchange): Promise<ArrayBuffer> {
  if (envelope.v !== '1' || envelope.kid !== exchange.keyInfo.kid || envelope.requestId !== exchange.requestId
      || envelope.timestamp !== exchange.timestamp || envelope.enc !== 'A256GCM') {
    throw new Error('加密响应元数据不匹配');
  }
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(envelope.iv), additionalData: exchange.aad, tagLength: 128 },
    exchange.aesKey,
    bytes(envelope.ciphertext),
  );
}

async function requestJson(source: Request | undefined, body: BodyInit | null | undefined): Promise<unknown> {
  if (body == null) {
    if (!source?.body) return null;
    return parseJson(await source.clone().text());
  }
  if (typeof body === 'string') return parseJson(body);
  if (body instanceof URLSearchParams) return Object.fromEntries(body.entries());
  throw new TypeError('管理端加密接口仅支持 JSON 请求体或 FormData 文件上传');
}

function parseJson(value: string): unknown { return value ? JSON.parse(value) : null; }

function protocolPath(input: RequestInfo | URL): string | null {
  const value = input instanceof Request ? input.url : String(input);
  const pathname = value.split(/[?#]/, 1)[0];
  const start = pathname.indexOf(API_PREFIX);
  return start < 0 ? null : pathname.slice(start);
}

function requestQuery(input: RequestInfo | URL): string {
  const value = input instanceof Request ? input.url : String(input);
  const queryStart = value.indexOf('?');
  if (queryStart < 0) return '';
  const hashStart = value.indexOf('#', queryStart);
  return value.slice(queryStart + 1, hashStart < 0 ? undefined : hashStart);
}

function withoutQuery(input: RequestInfo | URL): RequestInfo | URL {
  if (input instanceof Request) {
    const url = new URL(input.url);
    url.search = '';
    return new Request(url, input);
  }
  if (input instanceof URL) {
    const url = new URL(input);
    url.search = '';
    return url;
  }
  return input.replace(/\?[^#]*/, '');
}

async function fetchPublicKey(fetcher: typeof fetch, baseUrl: string, signal?: AbortSignal) {
  const response = await fetcher(`${baseUrl}${API_PREFIX}/crypto/public-key`, {
    headers: { Accept: 'application/json' }, credentials: 'include', signal,
  });
  const envelope = await response.json() as { code?: string; message?: string; data?: PublicKeyData };
  if (!response.ok || envelope.code !== 'OK' || !envelope.data) {
    throw new Error(envelope.message || '获取接口加密公钥失败');
  }
  return envelope.data;
}

async function isRejectedCryptoKey(response: Response) {
  if (response.status !== 400) return false;
  try {
    const body = await response.clone().json() as { code?: string };
    return body.code === 'CRYPTO_INVALID_REQUEST';
  } catch {
    return false;
  }
}

async function makeAad(
  method: string,
  path: string,
  kid: string,
  timestamp: number,
  requestId: string,
  authorization: string,
) {
  const authHash = authorization
    ? b64(await crypto.subtle.digest('SHA-256', encoder.encode(authorization)))
    : '';
  return encoder.encode(['v1', method.toUpperCase(), path, kid, String(timestamp), requestId, authHash].join('\n'));
}

async function responseError(response: Response) {
  let body: { code?: string; message?: string; traceId?: string } | null = null;
  try {
    body = await response.json() as { code?: string; message?: string; traceId?: string };
  } catch {
    // 网关错误页等非 JSON 响应按 HTTP 状态处理。
  }
  return new ApiError(
    body?.code ?? 'HTTP_ERROR',
    body?.message ?? `加密请求失败（HTTP ${response.status}）`,
    response.status,
    body?.traceId,
  );
}

function b64(value: ArrayBuffer | Uint8Array) {
  const data = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (let offset = 0; offset < data.length; offset += 0x8000) {
    binary += String.fromCharCode(...data.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytes(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const binary = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
