import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/features/auth/login/components/login-form";
import { AuthVisual } from "@/features/auth/components/auth-visual";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EpidomLogo } from "@/features/marketing/shared/components/epidom-logo";

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

export default async function LoginPage() {
  // Already signed in? Any CTA that lands here bounces the user to their stores.
  const session = await getSession();
  if (session?.user) redirect("/stores");

  return (
    <div
      className="grid h-screen w-full grid-cols-1 overflow-hidden md:grid-cols-2"
      style={{ background: "var(--epi-navy-900)" }}
    >
      {/* Left: Form Area */}
      {/* Removed justify-center to allow scrolling */}
      <div className="scrollbar-hide animate-in fade-in slide-in-from-left-4 relative flex h-full flex-col items-center overflow-y-auto p-8 duration-700">
        {/* Main Content - my-auto handles safe centering */}
        <div className="my-auto w-full max-w-[380px]">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <EpidomLogo size={28} href="/" />
          </div>

          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Footer - In flow, pushed to bottom by my-auto if space permits */}
        <div className="mt-8 w-full shrink-0 text-center">
          <p className="text-xs" style={{ color: "rgba(251,249,228,0.4)" }}>
            © 2025 Epidom. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right: Visual Area */}
      <div className="hidden h-full md:block">
        <AuthVisual />
      </div>
    </div>
  );
}
