<script setup lang="ts">
import { CircleCheckFilled, WarningFilled, Warning } from '@element-plus/icons-vue';
import { computed } from 'vue';
import type { DashboardStorage } from '../model';

const props = defineProps<{ storage: DashboardStorage }>();

const capacityState = computed(() => {
  if (props.storage.usedPercent >= 90) {
    return { label: '已暂停新上传', progressType: 'exception' as const, tagType: 'danger' as const, icon: WarningFilled };
  }
  if (props.storage.usedPercent >= 80) {
    return { label: '容量预警', progressType: 'warning' as const, tagType: 'warning' as const, icon: Warning };
  }
  return { label: '容量充足', progressType: 'success' as const, tagType: 'success' as const, icon: CircleCheckFilled };
});

const backupState = computed(() => ({
  healthy: { label: '备份正常', type: 'success' as const },
  delayed: { label: '备份延迟', type: 'warning' as const },
  failed: { label: '备份失败', type: 'danger' as const }
}[props.storage.backupStatus]));

const backupTime = computed(() => new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai'
}).format(new Date(props.storage.lastBackupAt)));
</script>

<template>
  <section class="panel storage-panel" aria-labelledby="storage-title">
    <div class="panel-heading"><div><h2 id="storage-title">存储与备份</h2><p>挂载路径 {{ storage.mount }}</p></div><el-tag :type="capacityState.tagType" effect="light">{{ capacityState.label }}</el-tag></div>
    <div class="capacity"><div class="capacity-head"><strong>已使用 {{ storage.usedPercent }}%</strong><span><el-icon><component :is="capacityState.icon" /></el-icon>{{ capacityState.label }}</span></div><el-progress :percentage="storage.usedPercent" :status="capacityState.progressType" :stroke-width="9" :show-text="false" /></div>
    <dl><div><dt>备份状态</dt><dd><el-tag :type="backupState.type" size="small" effect="plain">{{ backupState.label }}</el-tag></dd></div><div><dt>最近备份</dt><dd>{{ backupTime }}</dd></div></dl>
  </section>
</template>

<style scoped>
.panel { background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }
.panel-heading { display: flex; justify-content: space-between; align-items: flex-start; padding: 18px 18px 16px; }
h2 { margin: 0; color: var(--yl-text); font-size: 15px; font-weight: 700; }.panel-heading p { margin: 5px 0 0; color: var(--yl-text-muted); font-size: 11px; }
.capacity { padding: 0 18px 16px; }.capacity-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px; }.capacity-head strong { font-size: 13px; }.capacity-head span { display: inline-flex; align-items: center; gap: 4px; color: var(--yl-text-secondary); font-size: 11px; }
dl { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0; padding: 14px 18px 18px; border-top: 1px solid var(--yl-border); }dl div { min-width: 0; }dt { color: var(--yl-text-muted); font-size: 11px; }dd { margin: 7px 0 0; color: var(--yl-text-secondary); font-size: 12px; }
</style>
