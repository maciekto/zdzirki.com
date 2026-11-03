import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// W dev API i klipy idą do backendu (uvicorn na :8000).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/media': 'http://127.0.0.1:8000',
    },
  },
})
