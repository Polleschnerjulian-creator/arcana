export default function BankLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-80 bg-gray-100 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-40 bg-gray-200 rounded-lg" />
          <div className="h-10 w-44 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface shadow-sm"
          >
            <div className="p-6 pb-2">
              <div className="h-4 w-28 bg-gray-200 rounded" />
            </div>
            <div className="p-6 pt-0">
              <div className="h-8 w-16 bg-gray-200 rounded mt-1" />
              <div className="h-3 w-32 bg-gray-100 rounded mt-2" />
            </div>
          </div>
        ))}
      </div>

      {/* Reconciliation Progress Skeleton */}
      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="p-6">
          <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
          <div className="h-3 w-full bg-gray-100 rounded-full" />
          <div className="flex items-center gap-6 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gray-200" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bank Accounts List Skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface shadow-sm"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gray-200" />
                  <div>
                    <div className="h-5 w-36 bg-gray-200 rounded" />
                    <div className="h-3 w-48 bg-gray-100 rounded mt-1" />
                  </div>
                </div>
                <div className="h-4 w-32 bg-gray-100 rounded" />
              </div>
              {/* Transaction rows */}
              <div className="border-t border-border pt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-20 bg-gray-200 rounded" />
                      <div className="h-4 w-40 bg-gray-200 rounded" />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-20 bg-gray-200 rounded" />
                      <div className="h-5 w-20 bg-gray-200 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
