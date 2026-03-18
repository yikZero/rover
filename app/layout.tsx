import '@/app/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rover',
  description: 'AI-curated daily tech article digest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <main className="mx-auto max-w-5xl px-6 py-12 md:py-16">
          {children}
        </main>
      </body>
    </html>
  )
}
