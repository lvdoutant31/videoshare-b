export interface RuntimeLogSnapshot {
  available: boolean;
  sizeBytes: number;
  modifiedAt: string | null;
  truncated: boolean;
  lines: string[];
}

interface ApiEnvelope<T> { code: string; message?: string; data: T; }
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createHttpRuntimeLogRepository(baseUrl = '', fetcher: Fetcher = globalThis.fetch.bind(globalThis)) {
  return {
    async tail(lines = 300): Promise<RuntimeLogSnapshot> {
      const response = await fetcher(`${baseUrl}/api/v1/admin/runtime-logs?lines=${lines}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const body = await response.json() as ApiEnvelope<RuntimeLogSnapshot>;
      if (!response.ok || body.code !== 'OK') throw new Error(body.message || '读取运行日志失败');
      return body.data;
    },
  };
}
