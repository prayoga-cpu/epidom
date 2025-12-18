import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login/components/login-form";
import { LoginImage } from "@/features/auth/login/components/login-image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function LoginFormSkeleton() {
  return (
    <Card className="w-full max-w-md border-2 shadow-xl">
      <CardHeader className="space-y-2 pb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="grid h-screen grid-cols-1 md:grid-cols-2 overflow-hidden">
      <div className="overflow-y-auto p-6 sm:p-8 scrollbar-hide animate-slide-up">
        <div className="flex min-h-full items-center justify-center">
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
      <div className="h-full">
        <LoginImage />
      </div>
    </div>
  );
}

