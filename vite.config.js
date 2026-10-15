import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    watch: { ignored: ['**/.browser-check/**', '**/.game-data/**'] },
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.game-data/**', '**/.browser-check/**', '**/server/**', '**/src/data/products.js'] },
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
})
