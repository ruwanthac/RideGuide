interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700 ${className}`}
      aria-hidden
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
