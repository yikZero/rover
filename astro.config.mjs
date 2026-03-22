import tailwindcss from '@tailwindcss/vite'
import node from '@astrojs/node'
import sitemap from '@astrojs/sitemap'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, envField } from 'astro/config'

export default defineConfig({
  site: 'https://rover.yikzero.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    inlineStylesheets: 'always',
  },
  adapter: node({ mode: 'standalone' }),
  server: { host: '127.0.0.1', port: 47501 },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
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
    },
  },
  vite: {
    plugins: [tailwindcss(), visualizer({ emitFile: true, filename: 'stats.html' })],
  },
})
