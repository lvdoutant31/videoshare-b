<script setup lang="ts">
import { ref } from 'vue';

interface HealthResponse {
  code?: string;
  data: { service: string };
}

async function getHealth(baseUrl: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: 'application/json' } });
  const body = await response.json() as HealthResponse;
  if (!response.ok || (body.code !== undefined && body.code !== 'OK')) throw new Error('Health check failed');
  return body;
}

const state = ref<'idle' | 'ready' | 'unavailable'>('idle');
const service = ref('');

async function checkHealth() {
  try {
    const result = await getHealth(import.meta.env.VITE_API_BASE_URL ?? '/videoshare', '/api/v1/admin/health');
    service.value = result.data.service;
    state.value = 'ready';
  } catch {
    state.value = 'unavailable';
  }
}
</script>

<template>
  <main class="workspace">
    <h1>映流运营后台</h1>
    <p>后台工程基线</p>
    <button type="button" @click="checkHealth">检查服务</button>
    <p v-if="state === 'ready'">{{ service }} 已就绪</p>
    <p v-else-if="state === 'unavailable'">服务暂不可用</p>
  </main>
</template>
