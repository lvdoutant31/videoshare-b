export interface OssTestResult { key: string; url: string; fileName: string; size: number; contentType: string }
interface Envelope<T> { code: string; message?: string; data?: T; traceId?: string }
export class OssTestError extends Error { constructor(message: string, readonly code?: string, readonly traceId?: string) { super(message); this.name = 'OssTestError'; } }
export async function uploadOssTest(file: File, fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {
  const body = new FormData(); body.append('file', file);
  const response = await fetcher('/api/v1/admin/test/oss/upload', { method: 'POST', credentials: 'include', body });
  let envelope: Envelope<OssTestResult>;
  try { envelope = await response.json() as Envelope<OssTestResult>; } catch { throw new OssTestError('服务器返回了无效响应'); }
  if (!response.ok || envelope.code !== 'OK' || !envelope.data) throw new OssTestError(envelope.message || 'OSS 上传失败', envelope.code, envelope.traceId);
  return { data: envelope.data, traceId: envelope.traceId };
}
