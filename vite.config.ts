import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg'],
      manifest: {
        name: 'Meu Conselho de Saúde',
        short_name: 'Meu Conselho',
        description: 'Aprenda sobre o controle social do SUS e participe do conselho de saúde do seu bairro.',
        lang: 'pt-BR',
        theme_color: '#0f7a5c',
        background_color: '#f4f8f7',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /\/(rest|storage)\/v1\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
        ],
      },
    }),
  ],
})
