"use client";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "../../components/google-icon";
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
            callbackURL: "/stores",
          });
        }}
      >
        <GoogleIcon />
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
