import { describe, expect, it, vi } from 'vitest';
import { OssTestError, uploadOssTest } from './repository';

const ok = (data: unknown) => new Response(JSON.stringify({
  code: 'OK',
  data,
  traceId: 'trace-oss-test'
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('OSS test repository', () => {
  it('uploads only the selected file with credentialed multipart request', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({
      key: 'test-uploads/2026-09-03/file.txt',
      url: 'https://cdn.example/file.txt',
      fileName: 'file.txt',
      size: 4,
      contentType: 'text/plain'
    }));
    const file = new File(['test'], 'file.txt', { type: 'text/plain' });

    await expect(uploadOssTest(file, fetcher)).resolves.toMatchObject({
      traceId: 'trace-oss-test',
      data: { fileName: 'file.txt' }
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/admin/test/oss/upload');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(options.headers).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);
    const body = options.body as FormData;
    expect(Array.from(body.keys())).toEqual(['file']);
    expect(body.get('file')).toBe(file);
  });

  it('surfaces the server error and trace id', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'VALIDATION_FAILED',
      message: '文件不能为空',
      traceId: 'trace-invalid'
    }), { status: 422, headers: { 'Content-Type': 'application/json' } }));

    await expect(uploadOssTest(new File([''], 'empty.txt'), fetcher))
      .rejects.toMatchObject({
        message: '文件不能为空',
        code: 'VALIDATION_FAILED',
        traceId: 'trace-invalid'
      } satisfies Partial<OssTestError>);
  });
});
