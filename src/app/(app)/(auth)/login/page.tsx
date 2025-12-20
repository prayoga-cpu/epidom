import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login/components/login-form";
import { AuthVisual } from "@/features/auth/components/auth-visual";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";

function LoginFormSkeleton() {
  return (
    <Card className="w-full max-w-md border-0 bg-transparent shadow-none">
      <CardHeader className="space-y-2 px-0 pb-6">
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
    <div className="grid h-screen w-full grid-cols-1 overflow-hidden bg-white md:grid-cols-2">
      {/* Left: Form Area */}
      {/* Removed justify-center to allow scrolling */}
      <div className="scrollbar-hide animate-in fade-in slide-in-from-left-4 relative flex h-full flex-col items-center overflow-y-auto p-8 duration-700">
        {/* Main Content - my-auto handles safe centering */}
        <div className="my-auto w-full max-w-[380px]">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="relative h-8 w-32">
              <Image
                src="/images/logo-black.png"
                alt="Epidom"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Footer - In flow, pushed to bottom by my-auto if space permits */}
        <div className="mt-8 w-full shrink-0 text-center">
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
