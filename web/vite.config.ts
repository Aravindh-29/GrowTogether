import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'fs'

export default defineConfig(({ mode }) => {
  const isLan = mode === 'lan'
  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['framer-motion'],
            'vendor-signal': ['@microsoft/signalr'],
            'vendor-misc':   ['axios', 'zustand', '@tanstack/react-query', 'lucide-react', '@react-oauth/google'],
          },
        },
      },
    },
    server: {
      port: 5173,
      host: isLan ? '0.0.0.0' : undefined,
      https: isLan ? {
        key: readFileSync(new URL('certs/key.pem', import.meta.url)),
        cert: readFileSync(new URL('certs/cert.pem', import.meta.url)),
      } : undefined,
      proxy: {
        '/api': { target: 'http://localhost:5000', changeOrigin: true },
        '/health': { target: 'http://localhost:5000', changeOrigin: true },
        '/hubs': { target: 'http://localhost:5000', changeOrigin: true, ws: true },
      },
    },
  }
})
