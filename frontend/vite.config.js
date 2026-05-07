import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  envPrefix: 'VITE_',
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/auth':            { target: 'http://localhost:8000', changeOrigin: true },
      '/products':        { target: 'http://localhost:8000', changeOrigin: true },
      '/search':          { target: 'http://localhost:8000', changeOrigin: true },
      '/cart':            { target: 'http://localhost:8000', changeOrigin: true },
      '/recommendations': { target: 'http://localhost:8000', changeOrigin: true },
      '/reviews':         { target: 'http://localhost:8000', changeOrigin: true },
      '/orders':          { target: 'http://localhost:8000', changeOrigin: true },
      '/wishlist':        { target: 'http://localhost:8000', changeOrigin: true },
      '/profile':         { target: 'http://localhost:8000', changeOrigin: true },
      '/stats':           { target: 'http://localhost:8000', changeOrigin: true },
      '/hitl':            { target: 'http://localhost:8000', changeOrigin: true },
      '/seller':          { target: 'http://localhost:8000', changeOrigin: true },
      '/admin':           { target: 'http://localhost:8000', changeOrigin: true },
      '/agent':           { target: 'http://localhost:8000', changeOrigin: true },
      '/health':          { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
