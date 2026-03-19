import { DigestCardSkeleton } from '@/components/digest-card'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <section>
      <div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
      <div className="mt-12 md:mt-16">
        <DigestCardSkeleton />
        <DigestCardSkeleton />
        <DigestCardSkeleton />
        <DigestCardSkeleton />
        <DigestCardSkeleton />
      </div>
    </section>
  )
}
