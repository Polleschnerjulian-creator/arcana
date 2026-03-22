export default function AssetsLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-28 rounded-xl bg-gray-200/60 shimmer" />
          <div className="h-4 w-64 rounded-lg bg-gray-100/60 shimmer mt-2" />
        </div>
        <div className="h-10 w-40 rounded-xl bg-gray-200/60 shimmer" />
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gray-200/50 shimmer flex-shrink-0" />
            <div>
              <div className="h-6 w-16 rounded-lg bg-gray-200/60 shimmer" />
              <div className="h-3 w-24 rounded bg-gray-100/60 shimmer mt-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-3 border-b border-white/15 hidden md:flex items-center gap-6">
          <div className="h-3 w-32 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-24 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-28 rounded bg-gray-200/50 shimmer flex-1" />
          <div className="h-3 w-16 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-20 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-20 rounded bg-gray-200/50 shimmer" />
        </div>

        {/* Table Rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`px-6 py-3.5 flex items-center gap-6 ${
              i < 5 ? "border-b border-white/10" : ""
            }`}
          >
            <div className="h-4 w-32 rounded bg-gray-200/50 shimmer" />
            <div className="h-4 w-24 rounded bg-gray-100/40 shimmer" />
            <div
              className="h-4 rounded bg-gray-200/50 shimmer flex-1"
              style={{ maxWidth: `${100 + (i % 3) * 30}px` }}
            />
            <div className="h-4 w-16 rounded bg-gray-100/40 shimmer hidden md:block" />
            <div className="h-4 w-20 rounded bg-gray-100/40 shimmer hidden md:block" />
            <div className="h-8 w-24 rounded-xl bg-gray-200/50 shimmer ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
