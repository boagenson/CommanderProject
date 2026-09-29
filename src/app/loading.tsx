import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
