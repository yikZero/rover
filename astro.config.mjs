import tailwindcss from '@tailwindcss/vite'
import vercel from '@astrojs/vercel'
import { defineConfig, envField } from 'astro/config'

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  i18n: {
    locales: ['zh-CN', 'en'],
    defaultLocale: 'zh-CN',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  env: {
    schema: {
      DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
      GOOGLE_GENERATIVE_AI_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      CRON_SECRET: envField.string({ context: 'server', access: 'secret' }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
