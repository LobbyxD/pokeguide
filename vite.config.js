import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'))

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist' },
  server: { port: 5173 },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
})
