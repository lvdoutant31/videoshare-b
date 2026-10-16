import type { OperationLogPage, OperationLogQuery, OperationLogRepository } from './model';

interface ApiEnvelope<T> { code: string; message?: string; data: T; }
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createHttpSystemRepository(baseUrl = '', fetcher: Fetcher = globalThis.fetch.bind(globalThis)): OperationLogRepository {
  const endpoint = `${baseUrl}/api/v1/admin/operation-logs`;

  return {
    async list(query: OperationLogQuery): Promise<OperationLogPage> {
      const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
      if (query.module) params.set('module', query.module);
      if (query.action) params.set('action', query.action);
      if (query.actorId) params.set('actorId', query.actorId);
      if (query.targetType) params.set('targetType', query.targetType);
      if (query.status) params.set('status', query.status);
      if (query.startTime) params.set('startTime', query.startTime);
      if (query.endTime) params.set('endTime', query.endTime);

      const response = await fetcher(`${endpoint}?${params}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      const body = await response.json() as ApiEnvelope<OperationLogPage>;
      if (!response.ok || body.code !== 'OK') throw new Error(body.message || '查询操作日志失败');
      return body.data;
    }
  };
}
