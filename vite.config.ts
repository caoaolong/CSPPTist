import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isPreviewBuild = mode === 'preview'
  
  return {
    base: isPreviewBuild ? './' : '',
    plugins: [
      vue(),
    ],
    build: isPreviewBuild ? {
      outDir: 'dist-preview',
      rollupOptions: {
        input: {
          preview: fileURLToPath(new URL('./preview.html', import.meta.url)),
        },
        output: {
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
        },
      },
    } : undefined,
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:48080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/admin-api'),
        }
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            @import '@/assets/styles/variable.scss';
            @import '@/assets/styles/mixin.scss';
          `
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
})
