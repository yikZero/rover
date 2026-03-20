import tailwindcss from '@tailwindcss/vite'
import cloudflare from '@astrojs/cloudflare'
import { defineConfig, envField } from 'astro/config'

export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
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
      CLOUDFLARE_DEPLOY_HOOK_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
