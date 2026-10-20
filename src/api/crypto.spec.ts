import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../features/auth/http';
import { createEncryptedFetch, encryptedRequest } from './crypto';

const encoder = new TextEncoder();

describe('encryptedRequest', () => {
  it('encrypts a bodyless admin request and decrypts its response', async () => {
    const keys = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt'],
    ) as CryptoKeyPair;
    const spki = await crypto.subtle.exportKey('spki', keys.publicKey);
    const kid = 'admin-key';
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/api/v1/crypto/public-key')) {
        return Response.json({ code: 'OK', data: {
          v: '1', kid, alg: 'RSA-OAEP-256', enc: 'A256GCM', format: 'spki',
          publicKey: b64(spki), expiresAt: Date.now() + 60_000,
        } });
      }
      expect(String(input)).toBe('/videoshare/api/v1/admin/users');
      const encodedEnvelope = new Headers(init?.headers).get('X-Yingliu-Envelope');
      expect(encodedEnvelope).not.toBeNull();
      expect(init?.body).toBeNull();
      const request = JSON.parse(new TextDecoder().decode(bytes(encodedEnvelope!))) as Envelope & { encryptedKey: string; kid: string };
      const rawKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, keys.privateKey, bytes(request.encryptedKey));
      const aesKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
      const aad = encoder.encode(['v1', 'GET', '/api/v1/admin/users', kid, String(request.timestamp), request.requestId, ''].join('\n'));
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bytes(request.iv), additionalData: aad, tagLength: 128 }, aesKey, bytes(request.ciphertext),
      );
      expect(JSON.parse(new TextDecoder().decode(plaintext))).toEqual({ body: null, query: 'page=1' });
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
        aesKey,
        encoder.encode(JSON.stringify({ code: 'OK', data: { items: [] } })),
      );
      return Response.json({
        v: '1', kid, enc: 'A256GCM', requestId: request.requestId, timestamp: request.timestamp,
        iv: b64(iv), ciphertext: b64(ciphertext),
      }, { headers: { 'Content-Type': 'application/vnd.yingliu.encrypted+json' } });
    });

    const secureFetch = createEncryptedFetch('/videoshare', fetcher);
    const response = await secureFetch('/videoshare/api/v1/admin/users?page=1', { credentials: 'include' });

    await expect(response.json()).resolves.toEqual({ code: 'OK', data: { items: [] } });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('bypasses FormData uploads', async () => {
    const response = Response.json({ code: 'OK', data: null });
    const fetcher = vi.fn().mockResolvedValue(response);
    const secureFetch = createEncryptedFetch('/videoshare', fetcher);
    const body = new FormData();
    body.append('file', new Blob(['video']), 'video.mp4');

    await expect(secureFetch('/videoshare/api/v1/admin/videos/upload', {
      method: 'POST', credentials: 'include', body,
    })).resolves.toBe(response);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith('/videoshare/api/v1/admin/videos/upload', {
      method: 'POST', credentials: 'include', body,
    });
  });

  it('refreshes the public key once after the backend rotates it', async () => {
    const oldKeys = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt'],
    ) as CryptoKeyPair;
    const newKeys = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt'],
    ) as CryptoKeyPair;
    const keyPairs = [oldKeys, newKeys];
    let keyLoads = 0;
    let adminCalls = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/api/v1/crypto/public-key')) {
        const index = keyLoads++;
        const spki = await crypto.subtle.exportKey('spki', keyPairs[index].publicKey);
        return Response.json({ code: 'OK', data: {
          v: '1', kid: `key-${index}`, alg: 'RSA-OAEP-256', enc: 'A256GCM', format: 'spki',
          publicKey: b64(spki), expiresAt: Date.now() + 60_000,
        } });
      }
      if (adminCalls++ === 0) {
        return Response.json(
          { code: 'CRYPTO_INVALID_REQUEST', message: '加密请求无效', data: null },
          { status: 400 },
        );
      }
      const encodedEnvelope = new Headers(init?.headers).get('X-Yingliu-Envelope');
      const request = JSON.parse(new TextDecoder().decode(bytes(encodedEnvelope!))) as Envelope & {
        encryptedKey: string; kid: string;
      };
      expect(request.kid).toBe('key-1');
      const rawKey = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' }, newKeys.privateKey, bytes(request.encryptedKey),
      );
      const aesKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
      const aad = encoder.encode([
        'v1', 'GET', '/api/v1/admin/users', 'key-1', String(request.timestamp), request.requestId, '',
      ].join('\n'));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
        aesKey,
        encoder.encode(JSON.stringify({ code: 'OK', data: [] })),
      );
      return Response.json({
        v: '1', kid: 'key-1', enc: 'A256GCM', requestId: request.requestId, timestamp: request.timestamp,
        iv: b64(iv), ciphertext: b64(ciphertext),
      }, { headers: { 'Content-Type': 'application/vnd.yingliu.encrypted+json' } });
    });

    const response = await createEncryptedFetch('/videoshare', fetcher)(
      '/videoshare/api/v1/admin/users', { credentials: 'include' },
    );

    await expect(response.json()).resolves.toEqual({ code: 'OK', data: [] });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(keyLoads).toBe(2);
  });

  it('completes an RSA-OAEP and AES-GCM echo round trip', async () => {
    const message = 'x'.repeat(128 * 1024);
    const authorization = 'Bearer test-token';
    const keys = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt'],
    ) as CryptoKeyPair;
    const spki = await crypto.subtle.exportKey('spki', keys.publicKey);
    const kid = 'test-key';
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/api/v1/crypto/public-key')) {
        return Response.json({ code: 'OK', data: {
          v: '1', kid, alg: 'RSA-OAEP-256', enc: 'A256GCM', format: 'spki', publicKey: b64(spki), expiresAt: Date.now() + 60_000,
        } });
      }
      const request = JSON.parse(String(init?.body)) as Envelope & { encryptedKey: string };
      const rawKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, keys.privateKey, bytes(request.encryptedKey));
      const aesKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
      const authHeader = new Headers(init?.headers).get('Authorization') ?? '';
      const authHash = authHeader ? b64(await crypto.subtle.digest('SHA-256', encoder.encode(authHeader))) : '';
      const aad = encoder.encode(['v1', 'POST', '/api/v1/crypto/test/echo', kid, String(request.timestamp), request.requestId, authHash].join('\n'));
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bytes(request.iv), additionalData: aad, tagLength: 128 }, aesKey, bytes(request.ciphertext),
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, aesKey, plaintext,
      );
      return Response.json({
        v: '1', kid, enc: 'A256GCM', requestId: request.requestId, timestamp: request.timestamp,
        iv: b64(iv), ciphertext: b64(ciphertext),
      });
    });

    await expect(encryptedRequest<{ message: string }>('/crypto/test/echo', { message }, {
      fetcher, baseUrl: 'https://example.test', authorization,
    })).resolves.toEqual({ message });
  });

  it('preserves the API error code for encrypted login failures', async () => {
    const keys = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt'],
    ) as CryptoKeyPair;
    const spki = await crypto.subtle.exportKey('spki', keys.publicKey);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ code: 'OK', data: {
        v: '1', kid: 'test-key', alg: 'RSA-OAEP-256', enc: 'A256GCM', format: 'spki',
        publicKey: b64(spki), expiresAt: Date.now() + 60_000,
      } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: 'ACCOUNT_LOCKED', message: '账号已锁定', traceId: 'trace-1', data: null,
      }), { status: 423, headers: { 'Content-Type': 'application/json' } }));

    const failure = encryptedRequest('/admin/auth/login', { username: 'admin', password: 'wrong' }, { fetcher })
      .catch((error: unknown) => error);

    await expect(failure).resolves.toEqual(expect.objectContaining({
      name: 'ApiError', code: 'ACCOUNT_LOCKED', httpStatus: 423, traceId: 'trace-1',
    } satisfies Partial<ApiError>));
  });
});

interface Envelope { requestId: string; timestamp: number; iv: string; ciphertext: string }

function b64(value: ArrayBuffer | Uint8Array) {
  const data = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (let offset = 0; offset < data.length; offset += 0x8000) {
    binary += String.fromCharCode(...data.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytes(value: string) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
