interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'circle' | 'rect';
}

export function Skeleton({ className = '', variant = 'rect' }: SkeletonProps) {
  const base =
    'animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%]';
  const shape =
    variant === 'circle'
      ? 'rounded-full'
      : variant === 'text'
        ? 'h-4 rounded'
        : 'rounded-lg';
  return (
    <div
      data-testid={`skeleton-${variant}`}
      className={`${base} ${shape} ${className}`}
      aria-hidden
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div data-testid="dashboard-skeleton" className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="w-40 h-8" />
        <div className="flex gap-3">
          <Skeleton className="w-24 h-7" />
          <Skeleton className="w-28 h-7" />
          <Skeleton className="w-32 h-9" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl shadow-sm border p-5 space-y-3"
          >
            <Skeleton className="w-24 h-3" />
            <Skeleton className="w-20 h-8" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
          <Skeleton className="w-32 h-5" />
          <Skeleton className="w-full h-48" />
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
          <Skeleton className="w-40 h-5" />
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
        <Skeleton className="w-32 h-5" />
        <Skeleton className="w-full h-10" />
        <Skeleton className="w-full h-10" />
      </div>
    </div>
  );
}
