import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core', '@ffmpeg/util'],
  },
});
