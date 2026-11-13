import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app below /<repo>/, the dev server at the root.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/paralysis-analyse/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ParalysisAnalyse',
        short_name: 'ParalysisAnalyse',
        description: 'Misst die Zugzeiten beim Brettspielen und wertet sie aus.',
        lang: 'de',
        display: 'standalone',
        orientation: 'any',
        background_color: '#1b1612',
        theme_color: '#1b1612',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    // ECharts alone is ~800 kB; keep it in its own chunk so app updates don't invalidate it.
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { echarts: ['echarts', 'zrender'] } } },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
}));
