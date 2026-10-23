import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 本地开发时，页面请求 /api 会被转到本机接口，浏览器不会遇到跨域。
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
})
