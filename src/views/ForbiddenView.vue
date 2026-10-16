<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <main class="forbidden-page">
    <el-card class="forbidden-panel" shadow="never">
      <h1>无权访问</h1>
      <p>当前账号没有该页面的访问权限。如需访问，请联系管理员调整角色授权。</p>
      <el-button type="primary" @click="router.replace('/dashboard')">返回工作台</el-button>
    </el-card>
  </main>
</template>

<style scoped>
.forbidden-page { min-height: 100vh; display: grid; place-items: center; background: var(--yl-canvas); padding: 24px; }
.forbidden-panel { width: min(420px, 100%); border-radius: 8px; text-align: center; }
h1 { margin: 0; font-size: 22px; }
p { margin: 8px 0 22px; color: var(--el-text-color-secondary); }
</style>
