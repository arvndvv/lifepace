import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';

// Change this to your repository name:
const repo = 'lifepace'; // e.g., 'lifepace' if your repo is github.com/<you>/lifepace

export default defineConfig({
  // If this is a project page, set base to `/<repo>/`. If it’s a user/organization page, use '/'.
  base: `/${repo}/`,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'LifePace',
        short_name: 'LifePace',
        description: 'Plan your days and track your life progress in one place.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: `/${repo}/`, // match base so the PWA opens properly from Pages
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        navigateFallback: '/lifepace/index.html' // for Pages base path (adjust to `/${repo}/index.html`)
      },
      devOptions: { enabled: true }
    })
  ],
  server: { host: true }
});
