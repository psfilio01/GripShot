"use client";

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{
        background: "var(--gs-surface-inset)",
        ...style,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="gs-card-static p-5 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function SkeletonImageCard() {
  return (
    <div className="gs-card overflow-hidden">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="gs-card p-5 flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonImageCard key={i} />
        ))}
      </div>
    </div>
  );
}
