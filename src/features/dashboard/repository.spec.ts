import { describe, expect, it } from 'vitest';
import { mockDashboardRepository } from './mockRepository';
import { DashboardLoadError, createHttpDashboardRepository } from './repository';

describe('dashboard repository', () => {
  it('loads the PRD dashboard snapshot from the mock repository', async () => {
    const snapshot = await mockDashboardRepository.getSnapshot('7d');

    expect(snapshot.metrics.find((metric) => metric.key === 'plays')?.value).toBe('128,460');
    expect(snapshot.metrics.find((metric) => metric.key === 'publishedVideos')?.value).toBe('3,482');
    expect(snapshot.metrics.find((metric) => metric.key === 'interactions')?.changeLabel).toContain('点赞');
    expect(snapshot.recentVideos[0].interactionCount).toBe(4820);
    expect(snapshot.storage.usedPercent).toBe(72);
    expect(snapshot.trend.range).toBe('7d');
  });

  it('preserves the trace id when an HTTP module fails', async () => {
    const fetcher = async () => new Response(JSON.stringify({
      code: 'DASHBOARD_UNAVAILABLE',
      message: 'unavailable',
      traceId: 'trace-dashboard-001'
    }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    const repository = createHttpDashboardRepository('', fetcher);

    await expect(repository.getSnapshot('30d')).rejects.toEqual(
      expect.objectContaining<Partial<DashboardLoadError>>({
        name: 'DashboardLoadError',
        traceId: 'trace-dashboard-001'
      })
    );
  });

  it('normalizes legacy recent-video fields before rendering', async () => {
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input);
      const data = url.endsWith('/summary')
        ? {
            updatedAt: '2026-09-29T00:00:00Z',
            metrics: [],
            recentVideos: [{
              id: 'video-legacy',
              title: 'Legacy video',
              author: 'Author',
              status: 'published' as const,
              playCount: 12,
              publishedAt: '2026-09-28T00:00:00Z'
            }]
          }
        : url.includes('/trends?')
          ? { points: [] }
          : url.endsWith('/todos')
            ? { items: [] }
            : { usedBytes: 0, totalBytes: 1, usedPercent: 0, backupStatus: 'healthy' as const, lastBackupAt: null };

      return new Response(JSON.stringify({ code: 'OK', data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };
    const repository = createHttpDashboardRepository('', fetcher);

    const snapshot = await repository.getSnapshot('7d');

    expect(snapshot.recentVideos[0].interactionCount).toBeNull();
    expect(snapshot.recentVideos[0].updatedAt).toBe('2026-09-28T00:00:00Z');
  });
});
