import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckoutFailedContent } from "@/features/checkout/components/checkout-failed-content";

function CheckoutFailedSkeleton() {
  return (
    <div className="bg-background min-h-[100dvh]">
      <div className="flex min-h-[100dvh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <Skeleton className="h-20 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="mx-auto h-8 w-64" />
            <Skeleton className="mx-auto h-5 w-48" />
          </div>
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function CheckoutFailedPage() {
  return (
    <Suspense fallback={<CheckoutFailedSkeleton />}>
      <CheckoutFailedContent />
    </Suspense>
  );
}
