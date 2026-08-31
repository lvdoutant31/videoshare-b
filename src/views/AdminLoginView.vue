<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createAdminAuthRepository, authState } from '../features/auth/repository';

const router = useRouter();
const route = useRoute();
const username = ref('');
const password = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);
const repository = createAdminAuthRepository(import.meta.env.VITE_API_BASE_URL ?? '');

async function submit() {
  submitting.value = true;
  error.value = null;
  try {
    authState.session = await repository.login(username.value, password.value);
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/dashboard';
    await router.replace(redirect);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '登录失败';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="login-page">
    <el-card class="login-panel" shadow="never">
      <h1>映流管理后台</h1>
      <p>使用后台账号登录后继续。</p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名"><el-input v-model="username" autocomplete="username" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="password" type="password" show-password autocomplete="current-password" /></el-form-item>
        <el-button type="primary" native-type="submit" :loading="submitting" class="submit">登录</el-button>
      </el-form>
    </el-card>
  </main>
</template>

<style scoped>
.login-page { min-height: 100vh; display: grid; place-items: center; background: var(--yl-canvas); padding: 24px; }
.login-panel { width: min(400px, 100%); border-radius: 8px; }
h1 { margin: 0; font-size: 22px; }
p { margin: 8px 0 22px; color: var(--el-text-color-secondary); }
.el-alert { margin-bottom: 16px; }
.submit { width: 100%; }
</style>
