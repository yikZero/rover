import tailwindcss from '@tailwindcss/vite'
import vercel from '@astrojs/vercel'
import sitemap from '@astrojs/sitemap'
import AstroPWA from '@vite-pwa/astro'
import { defineConfig, envField } from 'astro/config'

export default defineConfig({
  site: 'https://rover.yikzero.com',
  output: 'static',
  trailingSlash: 'never',
  adapter: vercel(),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
    AstroPWA({
      outDir: 'dist/client',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Rover',
        short_name: 'Rover',
        description: 'AI-curated daily tech article digest',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      devOptions: {
        enabled: true,
        suppressWarnings: true,
      },
      workbox: {
        globDirectory: 'dist/client',
        globPatterns: ['**/*.{js,css,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/digests/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-digests',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /^\/digests\/.+/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ssr-pages',
              expiration: { maxEntries: 30, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
    }),
  ],
  i18n: {
    locales: ['zh-CN', 'en'],
    defaultLocale: 'zh-CN',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  prefetch: {
    defaultStrategy: 'hover',
  },
  env: {
    schema: {
      DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
      GOOGLE_GENERATIVE_AI_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      CRON_SECRET: envField.string({ context: 'server', access: 'secret' }),
      DEPLOY_HOOK_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
