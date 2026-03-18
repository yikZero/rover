'use client'

import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import useSWRInfinite from 'swr/infinite'
import type { DigestArticle } from '@/components/digest-card'
import { DigestCard, DigestCardSkeleton } from '@/components/digest-card'
import { Skeleton } from '@/components/ui/skeleton'
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
    <section>
      <Link href="/" className="group flex items-center gap-2">
        <ChevronLeft className="size-5 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
        <h2 className="text-balance font-semibold text-4xl text-muted-foreground">
          Digest{' '}
          <strong className="font-semibold text-foreground">History</strong>
        </h2>
      </Link>
      <div className="mt-12 space-y-14 md:mt-16">
        {!data && (
          <>
            <section>
              <Skeleton className="h-4 w-24" />
              <div className="mt-2">
                <DigestCardSkeleton />
                <DigestCardSkeleton />
                <DigestCardSkeleton />
              </div>
            </section>
            <section>
              <Skeleton className="h-4 w-24" />
              <div className="mt-2">
                <DigestCardSkeleton />
                <DigestCardSkeleton />
                <DigestCardSkeleton />
              </div>
            </section>
          </>
        )}
        {allDigests.map((digest) => (
          <section key={digest.date}>
            <Link
              href={`/digests/${digest.date}`}
              className="inline-block font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
            >
              {digest.date}
            </Link>
            <div className="mt-2">
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
    </section>
  )
}
