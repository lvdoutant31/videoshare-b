import type {
  DashboardRange,
  DashboardRepository,
  DashboardSnapshot,
  TrendPoint
} from './model';

const trend7d: TrendPoint[] = [
  { date: '08-21', plays: 84200, interactions: 10840 },
  { date: '08-22', plays: 91600, interactions: 12120 },
  { date: '08-23', plays: 88900, interactions: 11940 },
  { date: '08-24', plays: 103400, interactions: 13780 },
  { date: '08-25', plays: 111800, interactions: 14920 },
  { date: '08-26', plays: 113900, interactions: 15480 },
  { date: '08-27', plays: 128460, interactions: 17860 }
];

const trend30d: TrendPoint[] = [
  { date: '07-29', plays: 62100, interactions: 7840 },
  { date: '08-01', plays: 68400, interactions: 8560 },
  { date: '08-04', plays: 73100, interactions: 9180 },
  { date: '08-07', plays: 77900, interactions: 9820 },
  { date: '08-10', plays: 82600, interactions: 10640 },
  { date: '08-13', plays: 91800, interactions: 12120 },
  { date: '08-16', plays: 97400, interactions: 12880 },
  { date: '08-19', plays: 104200, interactions: 13940 },
  { date: '08-22', plays: 91600, interactions: 12120 },
  { date: '08-25', plays: 111800, interactions: 14920 },
  { date: '08-27', plays: 128460, interactions: 17860 }
];

function buildSnapshot(range: DashboardRange): DashboardSnapshot {
  return {
    updatedAt: '2026-08-27T06:32:00.000Z',
    metrics: [
      { key: 'plays', label: '今日有效播放', value: '128,460', changeLabel: '较昨日 +12.8%', tone: 'positive' },
      { key: 'newUsers', label: '今日新增用户', value: '1,284', changeLabel: '较昨日 +6.2%', tone: 'positive' },
      { key: 'publishedVideos', label: '已发布视频', value: '3,482', changeLabel: '今日发布 24 条', tone: 'neutral' },
      { key: 'interactions', label: '今日互动', value: '17,860', changeLabel: '点赞 12,420 · 收藏 2,890 · 评论 2,550', tone: 'positive' }
    ],
    trend: { range, points: range === '7d' ? trend7d : trend30d },
    todos: [
      { key: 'videoReview', label: '视频待审核', count: 18, tone: 'warning', to: '/reviews' },
      { key: 'report', label: '举报待处置', count: 12, tone: 'warning', to: '/reports' },
      { key: 'storageWarning', label: '存储容量预警', count: 0, tone: 'neutral' }
    ],
    storage: {
      mount: '/media',
      usedPercent: 72,
      backupStatus: 'healthy',
      lastBackupAt: '2026-08-27T02:12:00.000Z'
    },
    recentVideos: [
      {
        id: '90001', title: '客户现场安全操作要点', author: '安全培训组', status: 'published',
        playCount: 24860, interactionCount: 4820,
        publishedAt: '2026-08-27T01:00:00.000Z', updatedAt: '2026-08-27T01:00:00.000Z'
      },
      {
        id: '90002', title: '新员工入职培训', author: '人力资源中心', status: 'pendingReview',
        playCount: null, interactionCount: 0,
        publishedAt: null, updatedAt: '2026-08-27T05:30:00.000Z'
      },
      {
        id: '90003', title: '设备巡检标准流程', author: '设备管理部', status: 'transcoding',
        playCount: null, interactionCount: 0,
        publishedAt: null, updatedAt: '2026-08-27T04:45:00.000Z'
      },
      {
        id: '90004', title: '企业文化开放日纪实', author: '品牌中心', status: 'offShelf',
        playCount: 18240, interactionCount: 3012,
        publishedAt: '2026-08-25T03:30:00.000Z', updatedAt: '2026-08-27T02:10:00.000Z'
      }
    ]
  };
}

export const mockDashboardRepository: DashboardRepository = {
  async getSnapshot(range) {
    return structuredClone(buildSnapshot(range));
  }
};
