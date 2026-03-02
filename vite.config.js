import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/panel': 'http://localhost:8000',
      '/api': 'http://localhost:8000',
      '/media': 'http://localhost:8000'
    }
  }
})
