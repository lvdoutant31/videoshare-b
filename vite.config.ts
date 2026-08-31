import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: '/admin/',
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    proxy: { '/api': 'http://localhost:8080' },
  },
  test: { environment: 'jsdom', globals: true }
});
