import tailwindcss from '@tailwindcss/vite'
import vercel from '@astrojs/vercel'
import { defineConfig } from 'astro/config'

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
  vite: {
    plugins: [tailwindcss()],
  },
})
