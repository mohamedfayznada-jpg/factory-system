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
        name: 'شكاوى العاملين',
        short_name: 'شكاوى',
        description: 'بوابة شكاوى العاملين',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#1A0F12',
        background_color: '#F9E6D1',
        display: 'standalone',
        start_url: '/',
        icons: []
      },
      workbox: { navigateFallback: '/index.html' }
    })
  ]
});