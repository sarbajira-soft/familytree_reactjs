import { defineConfig } from 'vite'
 import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      sweetalert2: fileURLToPath(new URL('./src/sweetalert2-stub.js', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core', '@ffmpeg/util'],
  },
});
