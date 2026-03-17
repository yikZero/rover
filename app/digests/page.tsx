'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import useSWRInfinite from 'swr/infinite'
import type { DigestArticle } from '@/components/digest-card'
import { DigestCard } from '@/components/digest-card'
import { fetcher } from '@/lib/fetcher'

interface DigestWithArticles {
  id: number
  date: string
  articles: DigestArticle[]
}

interface DigestsResponse {
  digests: DigestWithArticles[]
  nextCursor: string | null
}

export default function DigestsPage() {
  const getKey = (
    pageIndex: number,
    previousPageData: DigestsResponse | null,
  ) => {
    if (previousPageData && !previousPageData.nextCursor) return null
    if (pageIndex === 0) return '/api/digests'
    return `/api/digests?cursor=${previousPageData?.nextCursor}`
  }

  const { data, setSize, isValidating } = useSWRInfinite<DigestsResponse>(
    getKey,
    fetcher,
  )

  const allDigests = data?.flatMap((page) => page.digests) ?? []
  const hasMore = data?.[data.length - 1]?.nextCursor !== null
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isValidating) {
          setSize((prev) => prev + 1)
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isValidating, setSize])

  return (
    <div>
      <h1 className="mb-6 font-semibold text-lg">历史精选</h1>
      <div className="space-y-10">
        {allDigests.map((digest) => (
          <section key={digest.date}>
            <Link
              href={`/digests/${digest.date}`}
              className="mb-3 block font-medium text-muted-foreground text-sm hover:text-foreground"
            >
              {digest.date}
            </Link>
            <div className="space-y-3">
              {digest.articles.map((article) => (
                <DigestCard key={article.url} article={article} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div
        ref={sentinelRef}
        className="py-8 text-center text-muted-foreground text-sm"
      >
        {isValidating ? '加载中...' : hasMore ? '' : '没有更多了'}
      </div>
    </div>
  )
}
