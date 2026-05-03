import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        id: '/',
        name: 'Varta',
        short_name: 'Varta',
        description: 'Real-time chat, stranger matching, friends, and calls.',
        theme_color: '#07070a',
        background_color: '#07070a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['social', 'communication'],
        icons: [
          { src: '/favicon.svg', sizes: '64x64', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/varta-icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/varta-icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ],
  server: {
    port: 5173
  }
});
