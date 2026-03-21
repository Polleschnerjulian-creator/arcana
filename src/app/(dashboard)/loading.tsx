export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Welcome Header Skeleton */}
      <div>
        <div className="h-8 w-64 rounded-xl bg-gray-200/60 shimmer" />
        <div className="h-4 w-48 rounded-lg bg-gray-100/60 shimmer mt-2" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="glass rounded-2xl p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="h-9 w-9 rounded-xl bg-primary/8 shimmer" />
              <div className="h-5 w-14 rounded-full bg-gray-100/60 shimmer" />
            </div>
            <div className="h-8 w-28 rounded-lg bg-gray-200/60 shimmer" />
            <div className="h-4 w-24 rounded-md bg-gray-100/60 shimmer mt-2" />
          </div>
        ))}
      </div>

      {/* Quick Actions Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5 flex flex-col items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/8 shimmer" />
            <div className="h-4 w-20 rounded-md bg-gray-200/60 shimmer" />
          </div>
        ))}
      </div>

      {/* Main Content Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart Skeleton */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="h-5 w-40 rounded-lg bg-gray-200/60 shimmer" />
            <div className="h-3 w-24 rounded-md bg-gray-100/60 shimmer" />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mb-5">
            <div className="h-6 w-24 rounded-full bg-gray-100/60 shimmer" />
            <div className="h-6 w-20 rounded-full bg-gray-100/60 shimmer" />
          </div>

          {/* Bar Chart Placeholder */}
          <div className="flex items-end gap-3 h-48">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="flex items-end gap-1 w-full h-40">
                  <div
                    className="flex-1 rounded-t-md bg-gray-200/50 shimmer"
                    style={{ height: `${25 + (i % 3) * 20}%` }}
                  />
                  <div
                    className="flex-1 rounded-t-md bg-gray-100/50 shimmer"
                    style={{ height: `${15 + (i % 2) * 25}%` }}
                  />
                </div>
                <div className="h-3 w-8 rounded bg-gray-100/60 shimmer" />
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-5 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
            <div>
              <div className="h-3 w-24 rounded bg-gray-100/60 shimmer" />
              <div className="h-4 w-20 rounded bg-gray-200/60 shimmer mt-1.5" />
            </div>
            <div>
              <div className="h-3 w-24 rounded bg-gray-100/60 shimmer" />
              <div className="h-4 w-20 rounded bg-gray-200/60 shimmer mt-1.5" />
            </div>
          </div>
        </div>

        {/* Recent Transactions Skeleton */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="h-5 w-32 rounded-lg bg-gray-200/60 shimmer" />
            <div className="h-4 w-24 rounded-md bg-gray-100/60 shimmer" />
          </div>
          <div className="px-6 pb-6 space-y-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 py-3.5 ${
                  i < 4 ? "border-b border-white/15" : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="h-2 w-2 rounded-full bg-gray-200/60 shimmer flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div
                      className="h-4 rounded bg-gray-200/60 shimmer"
                      style={{ width: `${100 + (i % 3) * 40}px` }}
                    />
                    <div className="h-3 w-36 rounded bg-gray-100/60 shimmer mt-1.5" />
                  </div>
                </div>
                <div className="h-4 w-20 rounded bg-gray-200/60 shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
