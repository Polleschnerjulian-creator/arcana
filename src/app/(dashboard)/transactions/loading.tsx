export default function TransactionsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-72 bg-gray-100 rounded mt-2" />
        </div>
      </div>

      {/* Filter Bar Skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-64 bg-gray-200 rounded-lg" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-gray-50/50">
              <th className="px-6 py-3 text-left">
                <div className="h-3 w-12 bg-gray-200 rounded" />
              </th>
              <th className="px-6 py-3 text-left">
                <div className="h-3 w-24 bg-gray-200 rounded" />
              </th>
              <th className="px-6 py-3 text-left">
                <div className="h-3 w-16 bg-gray-200 rounded" />
              </th>
              <th className="px-6 py-3 text-left">
                <div className="h-3 w-14 bg-gray-200 rounded" />
              </th>
              <th className="px-6 py-3 text-right">
                <div className="h-3 w-12 bg-gray-200 rounded ml-auto" />
              </th>
              <th className="px-6 py-3 text-right">
                <div className="h-3 w-12 bg-gray-200 rounded ml-auto" />
              </th>
              <th className="px-6 py-3 text-center">
                <div className="h-3 w-14 bg-gray-200 rounded mx-auto" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-3.5">
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                </td>
                <td className="px-6 py-3.5">
                  <div
                    className="h-4 bg-gray-200 rounded"
                    style={{ width: `${120 + (i % 3) * 40}px` }}
                  />
                </td>
                <td className="px-6 py-3.5">
                  <div className="h-4 w-28 bg-gray-100 rounded" />
                </td>
                <td className="px-6 py-3.5">
                  <div className="h-4 w-16 bg-gray-100 rounded" />
                </td>
                <td className="px-6 py-3.5 text-right">
                  <div className="h-4 w-20 bg-gray-200 rounded ml-auto" />
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
  );
}
