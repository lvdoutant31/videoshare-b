<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue';
import type { DashboardTodo } from '../model';

defineProps<{ todos: DashboardTodo[] }>();
</script>

<template>
  <section class="panel todo-panel" aria-labelledby="todo-title">
    <div class="panel-heading"><div><h2 id="todo-title">待处理事项</h2><p>优先关注影响内容安全与播放服务的任务</p></div></div>
    <ul v-if="todos.length" class="todo-list">
      <li v-for="todo in todos" :key="todo.key" :class="`todo-item--${todo.tone}`">
        <span class="todo-icon"><el-icon><WarningFilled /></el-icon></span>
        <RouterLink v-if="todo.to" :to="todo.to" class="todo-label">{{ todo.label }}</RouterLink>
        <span v-else class="todo-label">{{ todo.label }}</span>
        <strong>{{ todo.count }}</strong>
      </li>
    </ul>
    <p v-else class="empty-copy">当前没有待处理事项</p>
  </section>
</template>

<style scoped>
.panel { background: var(--yl-surface); border: 1px solid var(--yl-border); border-radius: 8px; }
.panel-heading { padding: 18px 18px 12px; }
h2 { margin: 0; color: var(--yl-text); font-size: 15px; font-weight: 700; }
.panel-heading p { margin: 5px 0 0; color: var(--yl-text-muted); font-size: 11px; }
.todo-list { display: grid; gap: 2px; margin: 0; padding: 0 10px 10px; list-style: none; }
li { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; align-items: center; min-height: 48px; padding: 0 8px; border-radius: 6px; }
li:hover { background: var(--yl-surface-subtle); }.todo-icon { display: grid; place-items: center; color: #64748b; font-size: 15px; }.todo-label { color: var(--yl-text-secondary); font-size: 13px; text-decoration: none; }.todo-label:hover { color: var(--yl-indigo); text-decoration: underline; }
strong { min-width: 24px; color: var(--yl-text); font-size: 16px; text-align: right; }.todo-item--warning .todo-icon, .todo-item--warning strong { color: #bd7916; }.todo-item--danger .todo-icon, .todo-item--danger strong { color: #d3434c; }
.empty-copy { margin: 0; padding: 16px 18px 24px; color: var(--yl-text-muted); font-size: 13px; }
</style>
