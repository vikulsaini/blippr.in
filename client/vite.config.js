import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png'],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        importScripts: ['/notification-sw.js'],
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,png,webmanifest}']
      },
      manifest: {
        id: '/',
        name: 'Blippr',
        short_name: 'Blippr',
        description: 'Real-time chat, stranger matching, friends, and calls.',
        theme_color: '#F8F9FA',
        background_color: '#F8F9FA',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['social', 'communication'],
        icons: [
          { src: '/favicon.png', sizes: '64x64', type: 'image/png', purpose: 'any' },
          { src: '/icons/blippr-icon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/blippr-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('socket.io-client')) {
              return 'vendor-socket';
            }
            return 'vendor';
          }
        }
      }
    }
  },
  server: {
    port: 5173
  }
});
