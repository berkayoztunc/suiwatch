import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/wallet': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/price': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/graphql': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/update-sui-price': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/sui-price-history': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/mmt-tokens': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
