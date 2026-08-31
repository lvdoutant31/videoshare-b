<script setup lang="ts">
import { TrendCharts, WarningFilled } from '@element-plus/icons-vue';
import type { DashboardMetric } from '../model';

defineProps<{ metric: DashboardMetric }>();
</script>

<template>
  <article class="metric-card" :class="`metric-card--${metric.tone}`">
    <div class="metric-card__heading">
      <span>{{ metric.label }}</span>
      <el-icon><TrendCharts v-if="metric.tone === 'positive'" /><WarningFilled v-else /></el-icon>
    </div>
    <strong>{{ metric.value }}</strong>
    <p>{{ metric.changeLabel }}</p>
  </article>
</template>

<style scoped>
.metric-card { min-height: 126px; padding: 18px; background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }
.metric-card__heading { display: flex; align-items: center; justify-content: space-between; color: var(--yl-text-secondary); font-size: 13px; }
.metric-card__heading .el-icon { color: var(--yl-text-muted); font-size: 17px; }
strong { display: block; margin-top: 16px; color: var(--yl-text); font-size: 27px; font-weight: 720; line-height: 1; }
p { margin: 10px 0 0; color: var(--yl-text-muted); font-size: 12px; }
.metric-card--positive p, .metric-card--positive .el-icon { color: #18896f; }
.metric-card--warning p, .metric-card--warning .el-icon { color: #bf7918; }
.metric-card--danger p, .metric-card--danger .el-icon { color: #d3434c; }
</style>
