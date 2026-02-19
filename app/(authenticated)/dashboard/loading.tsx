function MetricCardSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-4 h-4 w-24 animate-pulse rounded bg-neutral-200" />
      <div className="mb-2 h-8 w-32 animate-pulse rounded bg-neutral-200" />
      <div className="h-3 w-16 animate-pulse rounded bg-neutral-100" />
    </div>
  )
}

function PlatformSectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 animate-pulse rounded bg-neutral-200" />
        <div className="h-5 w-28 animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div className="space-y-8 p-8">
      {/* Period selector placeholder */}
      <div className="flex items-center justify-between">
        <div className="h-9 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="h-9 w-24 animate-pulse rounded bg-neutral-200" />
      </div>

      {/* Platform sections */}
      <PlatformSectionSkeleton />
      <PlatformSectionSkeleton />
      <PlatformSectionSkeleton />
    </div>
  )
}
