import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function CalendarLoading() {
  return (
    <div className="p-6">
      {/* Header: nav + filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-40 ml-2" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-8 w-44 rounded-lg" />
      </div>

      {/* Calendar grid skeleton */}
      <Card>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-8 gap-px mb-2">
            <Skeleton className="h-4 w-12" />
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
          {/* Hour rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-8 gap-px mb-1">
              <Skeleton className="h-[60px] w-12" />
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="h-[60px] w-full rounded" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
