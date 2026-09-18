<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createAdminAuthRepository, authState } from '../features/auth/repository';
import { ApiError, sanitizeRedirect } from '../features/auth/http';

const router = useRouter();
const route = useRoute();
const username = ref('');
const password = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);
const repository = createAdminAuthRepository(import.meta.env.VITE_API_BASE_URL ?? '/videoshare');

/** 由跳转方通过 query 传入的原因，让用户明白为什么回到了登录页。 */
const reasonNotice = computed(() => {
  switch (route.query.reason) {
    case 'expired': return '登录已过期，请重新登录。';
    case 'replaced': return '账号已在其他设备登录，当前会话已结束。';
    case 'kicked': return '账号已被强制下线。';
    case 'logout': return '已退出登录。';
    case 'required': return '请先登录后继续。';
    default: return null;
  }
});

/** 后端稳定错误码 → 面向用户的可读提示。 */
const MESSAGE_BY_CODE: Record<string, string> = {
  ACCOUNT_LOCKED: '登录失败次数过多，账号已被临时锁定，请稍后再试。',
  RATE_LIMITED: '登录请求过于频繁，请稍后再试。',
  CAPTCHA_REQUIRED: '需要输入验证码后才能继续登录。',
  CAPTCHA_INVALID: '验证码不正确，请重新输入。',
};

function messageOf(cause: unknown): string {
  if (cause instanceof ApiError) {
    return MESSAGE_BY_CODE[cause.code] ?? cause.message;
  }
  return cause instanceof Error ? cause.message : '登录失败';
}

async function submit() {
  submitting.value = true;
  error.value = null;
  try {
    authState.session = await repository.login(username.value, password.value);
    // 回跳地址来自查询串，必须清洗后再使用，避免开放重定向。
    await router.replace(sanitizeRedirect(route.query.redirect));
  } catch (cause) {
    error.value = messageOf(cause);
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
      <el-alert v-if="reasonNotice" :title="reasonNotice" type="warning" :closable="false" show-icon />
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
