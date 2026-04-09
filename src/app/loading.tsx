import { Skeleton } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="max-w-md w-full space-y-4">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
