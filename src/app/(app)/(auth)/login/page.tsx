import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login/components/login-form";
import { AuthVisual } from "@/features/auth/components/auth-visual";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function LoginFormSkeleton() {
  return (
    <Card className="w-full max-w-md border-0 shadow-none bg-transparent">
      <CardHeader className="space-y-2 pb-6 px-0">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64" />
      </CardHeader>
      <CardContent className="space-y-4 px-0">
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
    <div className="grid h-screen w-full grid-cols-1 md:grid-cols-2 overflow-hidden bg-white">
      {/* Left: Form Area */}
      <div className="flex flex-col overflow-y-auto px-6 py-12 sm:px-12 lg:px-24 xl:px-32 scrollbar-hide animate-slide-up">
        {/* Mobile Logo could go here */}
        <div className="mb-auto"></div>

        <div className="w-full max-w-sm mx-auto">
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>
        </div>

        <div className="mt-auto pt-10 text-center md:text-left">
           <p className="text-xs text-gray-400">© 2025 Epidom. All rights reserved.</p>
        </div>
      </div>

      {/* Right: Visual Area */}
      <div className="hidden h-full md:block">
        <AuthVisual />
      </div>
    </div>
  );
}

