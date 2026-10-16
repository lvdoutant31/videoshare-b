<script setup lang="ts">
import type { RecentVideo, VideoStatus } from '../model';

defineProps<{ videos: RecentVideo[] }>();

const statuses: Record<VideoStatus, { label: string; type: 'success' | 'warning' | 'info' | 'danger' }> = {
  published: { label: '已发布', type: 'success' },
  pendingReview: { label: '待审核', type: 'warning' },
  transcoding: { label: '转码中', type: 'info' },
  transcodeFailed: { label: '转码失败', type: 'danger' },
  offShelf: { label: '已下架', type: 'info' },
  rejected: { label: '已驳回', type: 'danger' },
  draft: { label: '草稿', type: 'info' }
};

function formatNumber(value: number | null) { return value === null ? '--' : new Intl.NumberFormat('zh-CN').format(value); }
function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).format(new Date(value)) : '--';
}
</script>

<template>
  <section class="panel videos-panel" aria-labelledby="videos-title">
    <div class="panel-heading"><div><h2 id="videos-title">最近视频</h2><p>最新内容及处理状态</p></div></div>
    <el-table :data="videos" size="small" empty-text="暂无最近视频" table-layout="fixed">
      <el-table-column prop="title" label="视频标题" min-width="220"><template #default="{ row }: { row: RecentVideo }"><div class="video-title">{{ row.title }}</div><small>ID {{ row.id }}</small></template></el-table-column>
      <el-table-column prop="author" label="发布者" min-width="140" />
      <el-table-column label="状态" width="100"><template #default="{ row }: { row: RecentVideo }"><el-tag :type="statuses[row.status].type" size="small" effect="plain">{{ statuses[row.status].label }}</el-tag></template></el-table-column>
      <el-table-column label="有效播放" width="110" align="right"><template #default="{ row }: { row: RecentVideo }">{{ formatNumber(row.playCount) }}</template></el-table-column>
      <el-table-column label="互动量" width="100" align="right"><template #default="{ row }: { row: RecentVideo }">{{ formatNumber(row.interactionCount) }}</template></el-table-column>
      <el-table-column label="最近更新" width="145"><template #default="{ row }: { row: RecentVideo }">{{ formatDate(row.updatedAt ?? row.publishedAt) }}</template></el-table-column>
    </el-table>
  </section>
</template>

<style scoped>
.panel { overflow: hidden; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.panel-heading { padding: 18px 18px 12px; }h2 { margin: 0; color: var(--yl-text); font-size: 15px; font-weight: 700; }.panel-heading p { margin: 5px 0 0; color: var(--yl-text-muted); font-size: 11px; }.video-title { overflow: hidden; color: var(--yl-text); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }.video-title + small { display: block; margin-top: 3px; color: var(--yl-text-muted); font-size: 10px; }
</style>
