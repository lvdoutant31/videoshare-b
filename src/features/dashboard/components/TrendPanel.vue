<script setup lang="ts">
import { init, use, type EChartsType } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { DashboardRange, DashboardTrend } from '../model';

use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{ trend: DashboardTrend; loading?: boolean }>();
const emit = defineEmits<{ 'update:range': [range: DashboardRange] }>();
const chartEl = ref<HTMLElement>();
const hasPoints = computed(() => props.trend.points.length > 0);
let chart: EChartsType | undefined;
let observer: ResizeObserver | undefined;

function renderChart() {
  if (!chartEl.value || !hasPoints.value) return;

  chart ??= init(chartEl.value);
  chart.setOption({
    color: ['#5b6cff', '#20b7b2'],
    tooltip: { trigger: 'axis' },
    legend: { right: 0, top: 0, textStyle: { color: '#566176', fontSize: 11 } },
    grid: { left: 8, right: 8, top: 42, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.trend.points.map((point) => point.date),
      axisLine: { lineStyle: { color: '#e3e7ee' } },
      axisLabel: { color: '#8a94a6', fontSize: 10 }
    },
    yAxis: [
      { type: 'value', splitLine: { lineStyle: { color: '#eef1f5' } }, axisLabel: { color: '#8a94a6', fontSize: 10 } },
      { type: 'value', splitLine: { show: false }, axisLabel: { show: false } }
    ],
    series: [
      { name: '播放量', type: 'line', smooth: true, showSymbol: false, data: props.trend.points.map((point) => point.plays), areaStyle: { opacity: 0.08 } },
      { name: '互动量', type: 'line', yAxisIndex: 1, smooth: true, showSymbol: false, data: props.trend.points.map((point) => point.interactions) }
    ]
  }, { notMerge: true });
}

watch(() => props.trend, async () => {
  await nextTick();
  renderChart();
}, { immediate: true, deep: true });

watch(hasPoints, async (value) => {
  if (!value) {
    chart?.dispose();
    chart = undefined;
    return;
  }
  await nextTick();
  renderChart();
});

watch(chartEl, (element) => {
  if (!element) return;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => chart?.resize());
    observer.observe(element);
  }
  renderChart();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
});
</script>

<template>
  <section class="panel trend-panel" aria-labelledby="trend-title">
    <div class="panel-heading">
      <div><h2 id="trend-title">播放与互动趋势</h2><p>统计区间内的内容分发表现</p></div>
      <div class="range-switch" role="group" aria-label="趋势统计区间">
        <button
          v-for="range in ['7d', '30d'] as DashboardRange[]"
          :key="range"
          type="button"
          :data-range="range"
          :class="{ active: trend.range === range }"
          :aria-pressed="trend.range === range"
          @click="emit('update:range', range)"
        >{{ range === '7d' ? '近 7 天' : '近 30 天' }}</button>
      </div>
    </div>
    <div v-if="hasPoints" ref="chartEl" class="chart" :class="{ 'is-loading': loading }"></div>
    <p v-else class="empty-copy">该区间暂无趋势数据</p>
  </section>
</template>

<style scoped>
.panel { background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; padding: 18px 18px 8px; }h2 { margin: 0; color: var(--yl-text); font-size: 15px; font-weight: 700; }.panel-heading p { margin: 5px 0 0; color: var(--yl-text-muted); font-size: 11px; }.range-switch { display: inline-flex; padding: 2px; background: #f0f3f8; border-radius: 6px; }.range-switch button { min-width: 57px; height: 27px; padding: 0 8px; color: var(--yl-text-secondary); background: transparent; border: 0; border-radius: 4px; font-size: 11px; cursor: pointer; }.range-switch button.active { color: #fff; background: var(--yl-indigo); }.chart { height: 258px; transition: opacity 160ms ease; }.chart.is-loading { opacity: 0.48; }.empty-copy { padding: 70px 18px; margin: 0; color: var(--yl-text-muted); font-size: 13px; text-align: center; }
</style>
