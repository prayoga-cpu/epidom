import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckoutSuccessContent } from "@/features/checkout/components/checkout-success-content";

function CheckoutSuccessSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="flex min-h-[100dvh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <Skeleton className="h-20 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="mx-auto h-8 w-64" />
            <Skeleton className="mx-auto h-5 w-48" />
          </div>
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<CheckoutSuccessSkeleton />}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
