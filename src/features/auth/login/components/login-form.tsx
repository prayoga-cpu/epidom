"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "../../validation/auth.schemas";
import { useLogin } from "../../hooks/use-auth";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || searchParams.get("callbackUrl");
  const registered = searchParams.get("registered");

  const { mutate: login, isPending, error } = useLogin();

  // Use ref to track if toast has already been shown
  const toastShownRef = useRef(false);

  // Show success toast for new registrations (only once)
  useEffect(() => {
    if (registered === "true" && !toastShownRef.current) {
      toastShownRef.current = true;
      toast.success(
        t("auth.accountCreatedSuccess") ||
          "Account created successfully! Please log in to continue."
      );

      // Remove the 'registered' query param to prevent toast from showing again
      // on component re-render or browser back/forward
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete("registered");
      const newUrl = newSearchParams.toString() ? `/login?${newSearchParams.toString()}` : "/login";
      router.replace(newUrl, { scroll: false });
    }
  }, [registered, searchParams, router]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginInput) => {
    login(data, {
      onSuccess: () => {
        toast.success(t("messages.loginSuccess") || "Logged in successfully!");

        // Use full page reload to ensure session is properly loaded
        // This prevents race condition where session might not be available yet
        // when the profile page tries to fetch user data

        // Redirect logic:
        // 1. If callbackUrl exists (from middleware or manual), redirect there
        // 2. If no callbackUrl, redirect to /stores (store selection page)
        //    This is more appropriate for new users than /profile
        const redirectUrl = nextUrl || "/stores";
        window.location.href = redirectUrl;
      },
      onError: (err) => {
        toast.error(err.message || t("messages.invalidCredentials"));
        // User stays on login page to retry
      },
    });
  };

  return (
    <div className="w-full space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-brand-primary text-2xl font-bold tracking-tight">
          {t("auth.welcome")}
        </h1>
        <p className="text-gray-500">{t("auth.signInToContinue")}</p>
      </div>

      <Button
        variant="outline"
        type="button"
        disabled={isPending}
        className="h-12 w-full rounded-xl border-gray-200 font-medium text-gray-700 hover:bg-gray-50"
        onClick={async () => {
          await authClient.signIn.social({
            provider: "google",
            callbackURL: "/onboarding",
          });
        }}
      >
        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">Or continue with email</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700">{t("auth.email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t("auth.emailPlaceholder") || "name@company.com"}
                      disabled={isPending}
                      autoComplete="email"
                      className="focus:border-brand-primary h-12 rounded-xl border-gray-200 bg-gray-50 transition-all focus:bg-white"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-gray-700">{t("auth.password")}</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="text-brand-primary hover:text-brand-primary/80 text-sm font-medium transition-colors"
                    >
                      {t("auth.forgotPassword")}
                    </Link>
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      disabled={isPending}
                      autoComplete="current-password"
                      className="focus:border-brand-primary h-12 rounded-xl border-gray-200 bg-gray-50 transition-all focus:bg-white"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            className="bg-brand-primary shadow-brand-primary/25 hover:bg-brand-primary/90 hover:shadow-brand-primary/40 h-12 w-full rounded-xl text-base font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
            disabled={isPending}
          >
            {isPending ? t("messages.loggingIn") || "Logging in..." : t("auth.loginButton")}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-gray-600">
        {t("auth.dontHaveAccount")}{" "}
        <Link
          href="/register"
          className="text-brand-primary hover:text-brand-primary/80 font-semibold transition-colors"
        >
          {t("auth.registerButton")}
        </Link>
      </p>
    </div>
  );
}
