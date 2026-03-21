export default function TransactionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-32 rounded-xl bg-gray-200/60 shimmer" />
          <div className="h-4 w-72 rounded-lg bg-gray-100/60 shimmer mt-2" />
        </div>
      </div>

      {/* Filter Bar Skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-64 rounded-xl glass shimmer" />
        <div className="h-10 w-32 rounded-xl glass shimmer" />
        <div className="h-10 w-32 rounded-xl glass shimmer" />
      </div>

      {/* Table Skeleton */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-3 border-b border-white/15 flex items-center gap-6">
          <div className="h-3 w-12 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-24 rounded bg-gray-200/50 shimmer flex-1" />
          <div className="h-3 w-16 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-14 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-12 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-12 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-14 rounded bg-gray-200/50 shimmer" />
        </div>

        {/* Table Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`px-6 py-3.5 flex items-center gap-6 ${
              i < 9 ? "border-b border-white/10" : ""
            }`}
          >
            <div className="h-4 w-20 rounded bg-gray-200/50 shimmer" />
            <div
              className="h-4 rounded bg-gray-200/50 shimmer flex-1"
              style={{ maxWidth: `${120 + (i % 3) * 40}px` }}
            />
            <div className="h-4 w-28 rounded bg-gray-100/40 shimmer" />
            <div className="h-4 w-16 rounded bg-gray-100/40 shimmer" />
            <div className="h-4 w-20 rounded bg-gray-200/50 shimmer ml-auto" />
            <div className="h-4 w-20 rounded bg-gray-200/50 shimmer" />
            <div className="flex justify-center">
              <div className="h-2 w-2 rounded-full bg-gray-200/60 shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
