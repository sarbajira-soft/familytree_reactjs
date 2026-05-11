// import { defineConfig } from 'vite'

// export default defineConfig({
//   base: '/',
//   optimizeDeps: {
//     exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core', '@ffmpeg/util'],
//   },
// });


import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  
  server: {
    host: true,
    allowedHosts: [
      'ectoplasmatic-spongily-davin.ngrok-free.dev'
    ]
  },

  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core', '@ffmpeg/util'],
  },
});