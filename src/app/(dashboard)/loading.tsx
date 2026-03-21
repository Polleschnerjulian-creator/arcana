export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Page Header */}
      <div>
        <div className="h-7 w-40 bg-gray-200 rounded" />
        <div className="h-4 w-64 bg-gray-200 rounded mt-2" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200" />
            <div className="p-6 pb-2">
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
            <div className="p-6 pt-0">
              <div className="h-8 w-32 bg-gray-200 rounded mt-1" />
              <div className="flex items-center gap-2 mt-3">
                <div className="h-3 w-20 bg-gray-100 rounded" />
                <div className="h-3 w-14 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Skeleton */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="h-5 w-40 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gray-200" />
                <div className="h-3 w-16 bg-gray-100 rounded" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gray-200" />
                <div className="h-3 w-16 bg-gray-100 rounded" />
              </div>
            </div>
            {/* Bar Chart Placeholder */}
            <div className="flex items-end gap-3 h-48">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex items-end gap-1 w-full h-40">
                    <div
                      className="flex-1 rounded-t bg-gray-200"
                      style={{ height: `${30 + Math.random() * 50}%` }}
                    />
                    <div
                      className="flex-1 rounded-t bg-gray-100"
                      style={{ height: `${20 + Math.random() * 40}%` }}
                    />
                  </div>
                  <div className="h-3 w-8 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
            {/* Summary row */}
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
              <div>
                <div className="h-3 w-28 bg-gray-100 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded mt-1" />
              </div>
              <div>
                <div className="h-3 w-28 bg-gray-100 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded mt-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Skeleton */}
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="p-6">
            <div className="h-5 w-28 bg-gray-200 rounded mb-4" />
          </div>
          <div className="p-6 pt-0 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg border border-border"
              >
                <div className="h-9 w-9 rounded-lg bg-gray-200 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-4 w-28 bg-gray-200 rounded" />
                  <div className="h-3 w-40 bg-gray-100 rounded mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions Skeleton */}
      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 bg-gray-200 rounded" />
            <div className="h-8 w-24 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-t border-border bg-gray-50/50">
                <th className="px-6 py-3 text-left">
                  <div className="h-3 w-12 bg-gray-200 rounded" />
                </th>
                <th className="px-6 py-3 text-left">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                </th>
                <th className="px-6 py-3 text-left">
                  <div className="h-3 w-16 bg-gray-200 rounded" />
                </th>
                <th className="px-6 py-3 text-right">
                  <div className="h-3 w-16 bg-gray-200 rounded ml-auto" />
                </th>
                <th className="px-6 py-3 text-center">
                  <div className="h-3 w-14 bg-gray-200 rounded mx-auto" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-3.5">
                    <div className="h-4 w-20 bg-gray-200 rounded" />
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="h-4 w-40 bg-gray-200 rounded" />
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="h-4 w-24 bg-gray-100 rounded" />
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="h-4 w-20 bg-gray-200 rounded ml-auto" />
                  </td>
                  <td className="px-6 py-3.5 flex justify-center">
                    <div className="h-5 w-16 bg-gray-200 rounded-full" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
