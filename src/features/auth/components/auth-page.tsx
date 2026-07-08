"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";
import { EpidomLogo } from "@/features/marketing/shared/components/epidom-logo";
import { LoginForm } from "../login/components/login-form";
import { RegisterForm } from "../register/components/register-form";
import { AuthVisual } from "./auth-visual";

type AuthMode = "login" | "register";

function AuthFormSkeleton() {
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

/**
 * Merged login/signup page — one shared shell + a mode toggle, instead of two
 * near-identical pages. `/login` and `/register` both render this (with the
 * matching `initialMode`) so every existing link to either URL keeps working;
 * switching modes here is an instant client-side toggle (shallow route replace
 * so the URL still reflects the mode, matches back/forward, and survives a refresh).
 */
export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setMode(next);
    router.replace(next === "login" ? "/login" : "/register", { scroll: false });
  };

  return (
    <div
      className="grid h-screen w-full grid-cols-1 overflow-hidden md:grid-cols-2"
      style={{ background: "var(--epi-navy-900)" }}
    >
      {/* Left: Form Area */}
      <div className="scrollbar-hide animate-in fade-in slide-in-from-left-4 relative flex h-full flex-col items-center overflow-y-auto p-8 duration-700">
        <div className="my-auto w-full max-w-[380px] space-y-6">
          <div className="flex justify-center">
            <EpidomLogo size={28} href="/" />
          </div>

          {/* Mode toggle */}
          <div
            className="grid grid-cols-2 gap-1 rounded-xl p-1"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={cn(
                "rounded-lg py-2 text-sm font-semibold transition-all",
                mode === "login"
                  ? "bg-[var(--epi-gold-500)] text-[var(--epi-navy-900)]"
                  : "text-[rgba(251,249,228,0.55)] hover:text-[var(--epi-cream-50)]"
              )}
            >
              {t("auth.loginButton")}
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={cn(
                "rounded-lg py-2 text-sm font-semibold transition-all",
                mode === "register"
                  ? "bg-[var(--epi-gold-500)] text-[var(--epi-navy-900)]"
                  : "text-[rgba(251,249,228,0.55)] hover:text-[var(--epi-cream-50)]"
              )}
            >
              {t("auth.registerButton")}
            </button>
          </div>

          <Suspense fallback={<AuthFormSkeleton />}>
            {mode === "login" ? <LoginForm /> : <RegisterForm />}
          </Suspense>
        </div>

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
