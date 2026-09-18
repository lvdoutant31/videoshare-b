import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: '/videoshare/admin/',
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    proxy: {
      '/videoshare/api': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/videoshare/, ''),
      },
      '/videoshare/media': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/videoshare/, ''),
      },
      '/api': 'http://localhost:8080',
      '/media': 'http://localhost:8080',
    },
  },
  test: { environment: 'jsdom', globals: true }
});
