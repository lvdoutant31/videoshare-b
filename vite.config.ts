import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const proxyTarget = env.VITE_PROXY_TARGET ?? 'http://localhost:8080';
  const mediaProxyTarget = env.VITE_MEDIA_PROXY_TARGET ?? proxyTarget;

  return {
    base: '/videoshare/admin/',
    plugins: [vue()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      proxy: {
        '/videoshare/api': {
          target: proxyTarget,
          rewrite: (path) => path.replace(/^\/videoshare/, ''),
        },
        '/videoshare/media': {
          target: mediaProxyTarget,
          rewrite: (path) => path.replace(/^\/videoshare/, ''),
        },
        '/api': proxyTarget,
        '/media': mediaProxyTarget,
      },
    },
    test: { environment: 'jsdom', globals: true },
  };
});
