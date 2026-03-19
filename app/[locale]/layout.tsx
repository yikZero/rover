import '@/app/globals.css'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { routing } from '@/i18n/routing'

export const metadata: Metadata = {
  title: 'Rover',
  description: 'AI-curated daily tech article digest',
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  setRequestLocale(locale)

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased">
        <NextIntlClientProvider>
          <main className="mx-auto max-w-5xl px-6 py-12 md:py-16">
            {children}
          </main>
          <footer className="mx-auto max-w-5xl px-6 pb-12">
            <LocaleSwitcher />
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
