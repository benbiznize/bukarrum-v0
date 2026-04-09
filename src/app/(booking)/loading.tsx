import { Skeleton } from "@/components/ui/skeleton";

export default function BookingLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="max-w-lg w-full space-y-6">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    </div>
  );
}
