import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    strictPort: true,
    proxy: {
      '/panel': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/auto-login': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        cookieDomainRewrite: '127.0.0.1'
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/assets': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
})
