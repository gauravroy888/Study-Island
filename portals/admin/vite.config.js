import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3001,
    open: true,
    strictPort: true,
  },
  build: {
    outDir: '../../admin',
    emptyOutDir: true
  }
})
