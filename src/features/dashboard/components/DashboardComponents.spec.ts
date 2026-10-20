import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import StoragePanel from './StoragePanel.vue';
import TrendPanel from './TrendPanel.vue';
import RecentVideosTable from './RecentVideosTable.vue';
import type { DashboardStorage, DashboardTrend, RecentVideo } from '../model';

vi.mock('echarts/core', () => ({
  init: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }),
  use: vi.fn()
}));

const trend: DashboardTrend = {
  range: '7d',
  points: [
    { date: '08-26', plays: 100, interactions: 20 },
    { date: '08-27', plays: 120, interactions: 26 }
  ]
};

const storage: DashboardStorage = {
  mount: '/media',
  usedPercent: 72,
  backupStatus: 'healthy',
  lastBackupAt: '2026-08-27T02:12:00.000Z'
};

const recentVideo: RecentVideo = {
  id: '90001', title: '视频标题', author: '作者', status: 'published', playCount: 1200,
  interactionCount: 84, publishedAt: '2026-08-27T01:00:00.000Z', updatedAt: '2026-08-27T02:00:00.000Z'
};

describe('dashboard components', () => {
  it('emits the selected trend range', async () => {
    const wrapper = mount(TrendPanel, { props: { trend } });

    await wrapper.get('[data-range="30d"]').trigger('click');

    expect(wrapper.emitted('update:range')).toEqual([['30d']]);
  });

  it('shows upload protection at ninety percent', () => {
    const wrapper = mount(StoragePanel, {
      props: { storage: { ...storage, usedPercent: 91 } },
      global: { stubs: { ElIcon: { template: '<span><slot /></span>' } } }
    });

    expect(wrapper.text()).toContain('已暂停新上传');
  });

  it('does not invent a backup time when backup tracking is unavailable', () => {
    const wrapper = mount(StoragePanel, {
      props: { storage: { ...storage, backupStatus: 'unknown', lastBackupAt: null } },
      global: { stubs: { ElIcon: { template: '<span><slot /></span>' } } }
    });

    expect(wrapper.text()).toContain('未接入');
    expect(wrapper.text()).toContain('暂无备份记录');
  });

  it('shows recent video interaction and update fields', () => {
    const wrapper = mount(RecentVideosTable, {
      props: { videos: [recentVideo] },
      global: { stubs: {
        ElTable: { template: '<div><slot /></div>' },
        ElTableColumn: { template: '<div>{{ label }}</div>', props: ['label'] },
        ElTag: { template: '<span><slot /></span>' }
      } }
    });

    expect(wrapper.text()).toContain('互动量');
    expect(wrapper.text()).toContain('最近更新');
  });
});
