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
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom'))
              return 'vendor-react'
            if (id.includes('node_modules/framer-motion'))
              return 'vendor-motion'
            if (id.includes('node_modules/@microsoft/signalr'))
              return 'vendor-signal'
            if (id.includes('node_modules/axios') || id.includes('node_modules/zustand') ||
                id.includes('node_modules/@tanstack') || id.includes('node_modules/lucide-react') ||
                id.includes('node_modules/@react-oauth'))
              return 'vendor-misc'
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
