import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config with proxy to FastAPI
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // frontend runs here
    proxy: {
      '/activities': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/tracked-identifiers': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})