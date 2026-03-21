export default function InvoicesLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-36 rounded-xl bg-gray-200/60 shimmer" />
          <div className="h-4 w-72 rounded-lg bg-gray-100/60 shimmer mt-2" />
        </div>
        <div className="h-10 w-40 rounded-xl bg-gray-200/60 shimmer" />
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`glass rounded-2xl p-4 flex items-center gap-3 ${
              i === 4 ? "col-span-2 sm:col-span-4 lg:col-span-1" : ""
            }`}
          >
            <div className="h-9 w-9 rounded-xl bg-gray-200/50 shimmer flex-shrink-0" />
            <div>
              <div className="h-6 w-10 rounded-lg bg-gray-200/60 shimmer" />
              <div className="h-3 w-16 rounded bg-gray-100/60 shimmer mt-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Search bar skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-72 rounded-xl glass shimmer" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-1 border-b border-white/15">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-2.5">
            <div className="h-4 rounded bg-gray-200/50 shimmer" style={{ width: `${60 + i * 10}px` }} />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-3 border-b border-white/15 hidden md:flex items-center gap-6">
          <div className="w-8" />
          <div className="h-3 w-24 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-28 rounded bg-gray-200/50 shimmer flex-1" />
          <div className="h-3 w-16 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-16 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-20 rounded bg-gray-200/50 shimmer" />
          <div className="h-3 w-16 rounded bg-gray-200/50 shimmer" />
        </div>

        {/* Table Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`px-6 py-3.5 flex items-center gap-6 ${
              i < 7 ? "border-b border-white/10" : ""
            }`}
          >
            <div className="w-4 h-4 rounded bg-gray-100/40 shimmer flex-shrink-0" />
            <div className="h-4 w-28 rounded bg-gray-200/50 shimmer" />
            <div
              className="h-4 rounded bg-gray-200/50 shimmer flex-1"
              style={{ maxWidth: `${100 + (i % 3) * 40}px` }}
            />
            <div className="h-4 w-20 rounded bg-gray-100/40 shimmer hidden md:block" />
            <div className="h-4 w-20 rounded bg-gray-100/40 shimmer hidden md:block" />
            <div className="h-4 w-24 rounded bg-gray-200/50 shimmer ml-auto" />
            <div className="h-5 w-16 rounded-full bg-gray-100/40 shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
