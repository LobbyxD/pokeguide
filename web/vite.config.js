import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  // Reuse the desktop app's public assets (type icons, maps, app-icon)
  publicDir: resolve(__dirname, '../public'),
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
  },
  server: {
    port: 5174,
  },
})
