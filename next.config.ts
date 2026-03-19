import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
  },
  cacheLife: {
    hours: { revalidate: 3600 },
    days: { revalidate: 86400 },
  },
}

export default withNextIntl(nextConfig)
